import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeContext, recommendContext, suggestGhost, contextRequestSchema, ghostRequestSchema } from "@navi-os/shared";
import { ContextController } from "../apps/extension/src/controller";
import { emptySession } from "../apps/extension/src/session/state";
import { postBackend } from "../apps/extension/src/backend/client";

function harness() {
  let stored = emptySession(); let active = 1; let time = 1800000000000;
  const tabs = new Map<number, any>([
    [1, { id: 1, windowId: 1, title: "React repository", url: "https://github.com/org/repo?token=never-send", incognito: false }],
    [2, { id: 2, windowId: 1, title: "React documentation", url: "https://react.dev/learn", incognito: false }],
    [3, { id: 3, windowId: 1, title: "Unapproved", url: "https://example.org/", incognito: false }],
  ]);
  const calls: { scripts: any[]; network: any[]; opened: any[]; gets: number[] } = { scripts: [], network: [], opened: [], gets: [] };
  let documentId = "doc-1"; let blocked = false; let hostAllowed = true;
  const g = globalThis as any;
  g.chrome = {
    runtime: { id: "a".repeat(32) },
    tabs: {
      query: async () => [tabs.get(active)],
      get: async (id: number) => { calls.gets.push(id); if (!tabs.has(id)) throw new Error("Tab closed"); return tabs.get(id); },
      create: async (args: any) => { calls.opened.push(args); return { id: 99 }; },
    },
    scripting: { executeScript: async (options: any) => {
      calls.scripts.push(options);
      return [{ documentId, frameId: 0, result: options.args ? { text: "React hooks TypeScript alice@example.com OTP: 123456", blocked } : tabs.get(options.target.tabId).url }];
    } },
    permissions: {
      contains: async () => hostAllowed,
      remove: async () => { hostAllowed = false; return true; },
    },
  };
  const store = { load: async () => structuredClone(stored), save: async (state: any) => { stored = structuredClone(state); } };
  const post: typeof postBackend = async (path, body, schema) => {
    calls.network.push({ path, body: structuredClone(body) });
    if (path === "/api/browser-context") return schema.parse(analyzeContext(contextRequestSchema.parse(body).tabs));
    if (path === "/api/contextflow") return schema.parse(recommendContext(contextRequestSchema.parse(body).tabs));
    return schema.parse(suggestGhost(ghostRequestSchema.parse(body)));
  };
  const controller = new ContextController(store, post, () => time);
  return { controller, tabs, calls, state: () => stored, restart: () => new ContextController(store, post, () => time),
    active: (id: number) => { active = id; }, document: (id: string) => { documentId = id; },
    blocked: (b: boolean) => { blocked = b; }, advance: (ms: number) => { time += ms; },
    cleanup: () => { delete g.chrome; },
  };
}
async function enroll(h: ReturnType<typeof harness>, id: number, content = false) {
  h.active(id); await h.controller.dispatch({ type: "AUTHORIZE_METADATA" });
  if (content) await h.controller.dispatch({ type: "AUTHORIZE_CONTENT" });
}

test("unauthorized content never triggers an injection or network request", async () => {
  const h = harness(); try {
    await h.controller.dispatch({ type: "CONNECT_BACKEND" });
    await assert.rejects(h.controller.dispatch({ type: "ANALYZE", tabIds: [3] }), /metadata permission/);
    assert.equal(h.calls.scripts.length, 0); assert.equal(h.calls.network.length, 0);
    await enroll(h, 1);
    await assert.rejects(h.controller.dispatch({ type: "ANALYZE", tabIds: [1] }), /content permission/);
    assert.equal(h.calls.scripts.length, 0); assert.equal(h.calls.network.length, 0);
    assert.equal(h.calls.gets.includes(3), false);
  } finally { h.cleanup(); }
});
test("one/two separately authorized document extractions send bounded sanitized context and return recommendations", async () => {
  const h = harness(); try {
    await h.controller.dispatch({ type: "CONNECT_BACKEND" });
    await enroll(h, 1, true); await enroll(h, 2, true);
    const view: any = await h.controller.dispatch({ type: "ANALYZE", tabIds: [1, 2] });
    assert.ok(view.analysis.topics.includes("react")); assert.equal(view.pending.length, 1);
    const sent = h.calls.network[0]!.body;
    assert.equal(sent.tabs.length, 2); assert.equal(sent.tabs[0].url, "https://github.com");
    assert.equal(JSON.stringify(sent).includes("token=never-send"), false);
    assert.equal(JSON.stringify(sent).includes("alice@example.com"), false);
    assert.equal(JSON.stringify(sent).includes("123456"), false);
    const injection = h.calls.scripts.find(c => c.args);
    assert.deepEqual(injection.target.documentIds, ["doc-1"]); assert.equal(injection.world, "ISOLATED");
    assert.equal(h.calls.opened.length, 0);
    assert.equal(JSON.stringify(h.state()).includes("React hooks"), false, "page text must not be stored");
  } finally { h.cleanup(); }
});
test("changed document URL or document ID and sensitive page controls fail before sending content", async () => {
  const h = harness(); try {
    await h.controller.dispatch({ type: "CONNECT_BACKEND" }); await enroll(h, 1, true);
    h.tabs.get(1).url = "https://github.com/new-page";
    await assert.rejects(h.controller.dispatch({ type: "ANALYZE", tabIds: [1] }), /content permission/);
    assert.equal(h.calls.network.length, 0);
    await h.controller.dispatch({ type: "AUTHORIZE_CONTENT" }); h.document("new-document");
    await assert.rejects(h.controller.dispatch({ type: "ANALYZE", tabIds: [1] }), /Extraction blocked/);
    assert.equal(h.calls.network.length, 0);
    await h.controller.dispatch({ type: "AUTHORIZE_CONTENT" }); h.blocked(true);
    await assert.rejects(h.controller.dispatch({ type: "ANALYZE", tabIds: [1] }), /Extraction blocked/);
    assert.equal(h.calls.network.length, 0);
  } finally { h.cleanup(); }
});
test("navigation revokes content, cross-origin navigation revokes metadata, unauthorized events are ignored", async () => {
  const h = harness(); try {
    await enroll(h, 1, true);
    await h.controller.updated(1, { status: "loading" }, h.tabs.get(1));
    assert.equal(h.state().tabs[1]!.content, undefined);
    await h.controller.updated(1, { url: "https://evil.test" }, { ...h.tabs.get(1), url: "https://evil.test" });
    assert.equal(h.state().tabs[1], undefined);
    await h.controller.updated(3, { title: "private" }, h.tabs.get(3)); await h.controller.activated(3);
    assert.equal(h.calls.gets.includes(3), false);
    assert.equal(h.state().ghost.patterns.length, 0);
  } finally { h.cleanup(); }
});
test("Ghost enable, pause, clear, disable and dismissal are session-scoped, never execute suggestions", async () => {
  const h = harness(); try {
    await enroll(h, 1); await enroll(h, 2);
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    assert.ok(h.state().pending[0]!.recommendation.title.includes("react"));
    assert.equal(h.calls.opened.length, 0); assert.equal(h.calls.network.length, 0);
    const id = h.state().pending[0]!.recommendation.id;
    await h.controller.dispatch({ type: "DISMISS", id });
    h.advance(31000); await h.controller.activated(1); assert.equal(h.state().pending.length, 0);
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "pause" });
    const before = structuredClone(h.state().ghost.patterns);
    h.advance(31000); await h.controller.activated(1); assert.deepEqual(h.state().ghost.patterns, before);
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "clear" });
    assert.deepEqual(h.state().ghost.patterns, []); assert.deepEqual(h.state().ghost.dismissed, []);
    assert.equal(h.state().ghost.mode, "paused");
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "disable" });
    assert.equal(h.state().ghost.mode, "disabled"); assert.deepEqual(h.state().ghost.patterns, []);
    assert.equal(h.calls.opened.length, 0);
  } finally { h.cleanup(); }
});
test("Ghost backend receives only aggregate categories; no raw history or text", async () => {
  const h = harness(); try {
    await enroll(h, 1); await enroll(h, 2);
    await h.controller.dispatch({ type: "CONNECT_BACKEND" });
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    await h.controller.dispatch({ type: "GHOST_SUGGEST" });
    const sent = h.calls.network[0]!;
    assert.equal(sent.path, "/api/ghost/suggestions");
    assert.equal(JSON.stringify(sent.body).includes("github.com"), false);
    assert.equal(h.state().pending[0]!.recommendation.requiresApproval, true);
  } finally { h.cleanup(); }
});
test("tab opening requires separate permission plus explicit selected-query approval, consumes approval against replay", async () => {
  const h = harness(); try {
    await enroll(h, 1); await enroll(h, 2);
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    const id = h.state().pending[0]!.recommendation.id;
    await assert.rejects(h.controller.dispatch({ type: "OPEN_SELECTED", id, indices: [0], approved: true }), /permission/);
    await h.controller.dispatch({ type: "SET_OPEN_PERMISSION", enabled: true });
    await assert.rejects(h.controller.dispatch({ type: "OPEN_SELECTED", id, indices: [0], approved: false } as any), /approval/);
    await assert.rejects(h.controller.dispatch({ type: "OPEN_SELECTED", id, indices: [99], approved: true }), /selection/);
    assert.equal(h.calls.opened.length, 0);
    await h.controller.dispatch({ type: "OPEN_SELECTED", id, indices: [0, 2], approved: true });
    assert.equal(h.calls.opened.length, 2);
    for (const args of h.calls.opened) {
      const url = new URL(args.url); assert.equal(url.origin + url.pathname, "https://www.google.com/search");
      assert.ok(url.searchParams.get("q")!.includes("react")); assert.equal(args.active, false);
    }
    await assert.rejects(h.controller.dispatch({ type: "OPEN_SELECTED", id, indices: [0], approved: true }), /unavailable/);
    assert.equal(h.calls.opened.length, 2);
  } finally { h.cleanup(); }
});
test("revocation, closed tabs, consent TTL and pending TTL are enforced", async () => {
  const h = harness(); try {
    await enroll(h, 1, true); await enroll(h, 2);
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    const id = h.state().pending[0]!.recommendation.id;
    await h.controller.dispatch({ type: "SET_OPEN_PERMISSION", enabled: true });
    h.advance(5 * 60000 + 1);
    await assert.rejects(h.controller.dispatch({ type: "OPEN_SELECTED", id, indices: [0], approved: true }), /expired/);
    await h.controller.dispatch({ type: "REVOKE_CONTENT", tabId: 1 }); assert.equal(h.state().tabs[1]!.content, undefined);
    await h.controller.removed(2); assert.equal(h.state().tabs[2], undefined);
    h.advance(30 * 60000); await h.controller.dispatch({ type: "STATE" }); assert.deepEqual(h.state().tabs, {});
  } finally { h.cleanup(); }
});
test("clearing all session data revokes permissions, counters, recommendations and backend consent", async () => {
  const h = harness(); try {
    await enroll(h, 1, true); await enroll(h, 2);
    await h.controller.dispatch({ type: "CONNECT_BACKEND" }); await h.controller.dispatch({ type: "SET_OPEN_PERMISSION", enabled: true });
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    await h.controller.dispatch({ type: "CLEAR_SESSION" });
    assert.deepEqual(h.state(), emptySession());
    await assert.rejects(h.controller.dispatch({ type: "CONNECT_BACKEND" }), /not granted/);
    assert.equal(h.calls.opened.length, 0);
  } finally { h.cleanup(); }
});
test("sensitive and incognito tabs cannot enroll; tab authorization alone does not permit monitoring or content", async () => {
  const h = harness(); try {
    h.tabs.get(1).incognito = true; await assert.rejects(enroll(h, 1), /incognito/);
    h.tabs.get(1).incognito = false; h.tabs.get(1).url = "https://example.org/login";
    await assert.rejects(enroll(h, 1), /non-sensitive/);
    await enroll(h, 2); assert.equal(h.state().ghost.mode, "disabled");
    assert.equal(h.state().tabs[2]!.content, undefined); assert.equal(h.state().openTabsAllowed, false);
  } finally { h.cleanup(); }
});

test("session permissions and counters survive service-worker recreation without durable history", async () => {
  const h = harness(); try {
    await enroll(h, 1, true); await enroll(h, 2);
    await h.controller.dispatch({ type: "GHOST_CONTROL", action: "enable" });
    const recreated = h.restart(); const view: any = await recreated.dispatch({ type: "STATE" });
    assert.equal(view.tabs.length, 2); assert.equal(view.tabs[0].contentAllowed, true);
    assert.equal(view.ghost.mode, "enabled"); assert.equal(view.ghost.patterns.length, 1);
  } finally { h.cleanup(); }
});
test("backend client checks optional host permission and fixed paths, sends no cookies, validates responses", async () => {
  const h = harness(); const originalFetch = globalThis.fetch;
  try {
    const result = recommendContext([{ tabId: 1, title: "React", url: "https://react.dev", text: "", capturedAt: 0 }]);
    let options: RequestInit | undefined;
    globalThis.fetch = (async (url: string | URL | Request, init: RequestInit) => {
      assert.equal(url, "http://localhost:3000/api/contextflow"); options = init;
      return Response.json(result);
    }) as typeof fetch;
    const { recommendationsSchema } = await import("@navi-os/shared");
    await postBackend("/api/contextflow", {}, recommendationsSchema);
    assert.equal(options!.credentials, "omit"); assert.equal(options!.redirect, "error");
    assert.equal((options!.headers as any)["X-Navi-Extension-Id"], "a".repeat(32));
    await assert.rejects(postBackend("https://evil.test", {}, recommendationsSchema), /Unknown endpoint/);
    globalThis.fetch = (async () => Response.json({ ...result, evil: true })) as typeof fetch;
    await assert.rejects(postBackend("/api/contextflow", {}, recommendationsSchema), /schema/);
    await h.controller.dispatch({ type: "CLEAR_SESSION" });
    await assert.rejects(postBackend("/api/contextflow", {}, recommendationsSchema), /Connect/);
  } finally { globalThis.fetch = originalFetch; h.cleanup(); }
});
