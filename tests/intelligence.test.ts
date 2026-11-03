import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeContext, recommendContext, suggestGhost, sanitizeText, contextRequestSchema, recommendationsSchema,
  analysisSchema, ghostRequestSchema, isSensitiveUrl, safeOrigin } from "@navi-os/shared";
import { emptySession, pruneSession, SESSION_TTL } from "../apps/extension/src/session/state";
import { observeSession, localGhostSuggestions } from "../apps/extension/src/ghost/session";
import { parseCommand, isPopupSender } from "../apps/extension/src/messaging/internal";
import { POST as analyze } from "../apps/web/src/app/api/browser-context/route";
import { POST as flow } from "../apps/web/src/app/api/contextflow/route";
import { POST as ghost } from "../apps/web/src/app/api/ghost/suggestions/route";
import { validatedPost } from "../apps/web/src/server/api/validated";

const now = 1800000000000;
const tabs = [
  { tabId: 1, title: "React project", url: "https://github.com", text: "React components TypeScript", capturedAt: now },
  { tabId: 2, title: "React documentation", url: "https://react.dev", text: "React hooks", capturedAt: now },
];
const request = { version: 1, tabs };
function req(body: unknown = request, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/browser-context", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}
test("topics/sites are derived from supplied context and hostname boundaries", () => {
  assert.deepEqual(analyzeContext(tabs).sites, ["github", "documentation"]);
  assert.ok(analyzeContext(tabs).topics.includes("react"));
  assert.deepEqual(analyzeContext([{ ...tabs[0]!, url: "https://github.com.evil.test", title: "Unknown", text: "" }]).sites, ["other"]);
});
test("ContextFlow yields relevant queries, no invented source URLs, and requires approval", () => {
  const result = recommendationsSchema.parse(recommendContext(tabs));
  assert.ok(result.recommendations[0]!.queries.every(q => q.includes("react")));
  assert.equal(result.recommendations[0]!.requiresApproval, true);
  assert.ok(result.recommendations[0]!.queries.every(q => !q.startsWith("http")));
  assert.deepEqual(recommendContext([{ ...tabs[0]!, title: "Nothing", url: "https://example.org", text: "" }]).recommendations, []);
});
test("Ghost recognizes GitHub + docs + Stack Overflow; confidence increases with repetitions", () => {
  const pattern = { sites: ["github", "documentation", "stackoverflow"] as const, topics: ["react", "development"] as const, count: 1, lastSeenAt: now };
  const low = suggestGhost({ version: 1, patterns: [{ ...pattern, sites: [...pattern.sites], topics: [...pattern.topics] }] }).recommendations[0]!;
  const high = suggestGhost({ version: 1, patterns: [{ ...pattern, sites: [...pattern.sites], topics: [...pattern.topics], count: 20 }] }).recommendations[0]!;
  assert.ok(low.title.includes("react")); assert.ok(high.confidence > low.confidence); assert.ok(high.confidence <= 1);
  assert.equal(high.requiresApproval, true);
  assert.deepEqual(suggestGhost({ version: 1, patterns: [] }).recommendations, []);
});
test("Ghost session defaults off, counts combinations without raw history and expires", () => {
  const state = emptySession();
  for (const tab of tabs) state.tabs[tab.tabId] = { id: tab.tabId, windowId: 1, title: tab.title, url: tab.url, origin: tab.url, expiresAt: now + SESSION_TTL };
  observeSession(state, now); assert.equal(state.ghost.patterns.length, 0);
  state.ghost.mode = "enabled"; observeSession(state, now);
  assert.equal(localGhostSuggestions(state).length, 1);
  observeSession(state, now + 100); assert.equal(state.ghost.patterns[0]!.count, 1);
  observeSession(state, now + 31000); assert.equal(state.ghost.patterns[0]!.count, 2);
  assert.equal(JSON.stringify(state.ghost.patterns).includes("github.com"), false);
  state.ghost.mode = "paused"; observeSession(state, now + 62000);
  assert.equal(state.ghost.patterns[0]!.count, 2); assert.deepEqual(localGhostSuggestions(state), []);
  pruneSession(state, now + SESSION_TTL * 2);
  assert.deepEqual(state.tabs, {}); assert.deepEqual(state.ghost.patterns, []);
});
test("sensitive text redaction and sensitive URL defenses", () => {
  const output = sanitizeText("React email alice@example.com OTP: 123456 ghp_abcdefghijklmnopqrstuvwxyz123456 https://example.org/?token=secret");
  for (const secret of ["alice@example.com", "123456", "abcdefghijklmnopqrstuvwxyz", "token=secret"]) assert.equal(output.includes(secret), false);
  for (const url of ["chrome://settings", "https://mail.google.com", "https://example.com/login", "https://example.com/checkout", "https://user:pass@example.com"]) assert.equal(isSensitiveUrl(url), true);
  assert.equal(isSensitiveUrl("https://react.dev/learn"), false);
  assert.equal(safeOrigin("https://react.dev/learn?secret=1#hash"), "https://react.dev");
});
for (const bad of [null, { ...request, extra: true }, { version: 2, tabs }, { version: 1, tabs: [] }, { version: 1, tabs: [...tabs, tabs[0]] },
  { version: 1, tabs: [tabs[0], tabs[0]] }, { version: 1, tabs: [{ ...tabs[0], url: "https://github.com/path?token=secret" }] },
  { version: 1, tabs: [{ ...tabs[0], text: "x".repeat(8001) }] }, { version: 1, tabs: [{ ...tabs[0], tabId: -1 }] }]) {
  test(`context schema rejects invalid payload ${JSON.stringify(bad).slice(0, 70)}`, () => assert.throws(() => contextRequestSchema.parse(bad)));
}
test("response schemas reject actions, fabricated fields, and unapproved suggestions", () => {
  const response = recommendContext(tabs); const s = response.recommendations[0]!;
  assert.throws(() => recommendationsSchema.parse({ version: 1, recommendations: [{ ...s, requiresApproval: false }] }));
  assert.throws(() => recommendationsSchema.parse({ version: 1, recommendations: [{ ...s, sourceUrl: "https://made-up.test" }] }));
  assert.throws(() => recommendationsSchema.parse({ version: 1, recommendations: [{ ...s, confidence: 1.2 }] }));
  assert.throws(() => analysisSchema.parse({ version: 1, topics: ["made-up"], sites: [] }));
  assert.throws(() => ghostRequestSchema.parse({ version: 1, patterns: [{ sites: [], topics: [], count: 1000, lastSeenAt: now }] }));
});
test("internal command validation forbids arbitrary actions and unapproved opens", () => {
  for (const value of [{ type: "OPEN_SELECTED", id: "x", indices: [0], approved: false }, { type: "OPEN_SELECTED", id: "x", indices: [0, 0], approved: true },
    { type: "OPEN_SELECTED", id: "x", indices: [0], approved: true, url: "https://evil.test" }, { type: "ANALYZE", tabIds: [] }, { type: "EXECUTE", script: "alert(1)" }]) assert.throws(() => parseCommand(value));
  assert.equal(parseCommand({ type: "OPEN_SELECTED", id: "x", indices: [0], approved: true }).type, "OPEN_SELECTED");
});
test("internal transport accepts popup only, not content scripts or web senders", () => {
  const g = globalThis as any;
  g.chrome = { runtime: { id: "own", getURL: (p: string) => `chrome-extension://own/${p}` } };
  try {
    assert.equal(isPopupSender({ id: "own", url: "chrome-extension://own/popup.html" }), true);
    for (const sender of [{ id: "own", url: "https://evil.test", tab: { id: 1 } }, { id: "other", url: "chrome-extension://own/popup.html" }, { url: "http://localhost:3000" }]) assert.equal(isPopupSender(sender as any), false);
  } finally { delete g.chrome; }
});
for (const [name, route] of [["analysis", analyze], ["contextflow", flow]] as const) {
  test(`${name} API validates supplied context and successful response`, async () => {
    const response = await route(req()); assert.equal(response.status, 200);
    const body = await response.json();
    if (name === "analysis") analysisSchema.parse(body); else recommendationsSchema.parse(body);
    assert.equal(JSON.stringify(body).includes("React project"), false);
  });
  test(`${name} API denies malicious origins, unknown fields, malformed and oversized bodies`, async () => {
    assert.equal((await route(req(request, { origin: "https://evil.test" }))).status, 403);
    assert.equal((await route(req({ ...request, command: "open" }))).status, 400);
    assert.equal((await route(req(request, { "content-type": "text/plain" }))).status, 415);
    assert.equal((await route(req({ padding: "x".repeat(33000) }))).status, 413);
    assert.equal((await route(new Request("http://localhost:3000/api", { method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: "{bad-json" }))).status, 400);
  });
}
test("Ghost API produces schema-validated deterministic suggestion", async () => {
  const response = await ghost(req({ version: 1, patterns: [{ sites: ["github", "documentation"], topics: ["react"], count: 2, lastSeenAt: now }] }));
  assert.equal(response.status, 200); const body = recommendationsSchema.parse(await response.json());
  assert.equal(body.recommendations[0]!.requiresApproval, true);
});
test("API allowlists extension identity; denies cross-site spoofing and missing identity", async () => {
  const old = process.env.NAVI_EXTENSION_ID; process.env.NAVI_EXTENSION_ID = "a".repeat(32);
  try {
    assert.equal((await analyze(req(request, { origin: "chrome-extension://" + "a".repeat(32), "x-navi-extension-id": "a".repeat(32) }))).status, 200);
    assert.equal((await analyze(req(request, { origin: "https://evil.test", "x-navi-extension-id": "a".repeat(32) }))).status, 403);
    const missing = req(); missing.headers.delete("origin");
    assert.equal((await analyze(missing)).status, 403);
    const extensionWithoutOrigin = req(request, { "x-navi-extension-id": "a".repeat(32) }); extensionWithoutOrigin.headers.delete("origin");
    assert.equal((await analyze(extensionWithoutOrigin)).status, 200);
    assert.equal((await analyze(req(request, { origin: "chrome-extension://" + "b".repeat(32), "x-navi-extension-id": "b".repeat(32) }))).status, 403);
  } finally { if (old === undefined) delete process.env.NAVI_EXTENSION_ID; else process.env.NAVI_EXTENSION_ID = old; }
});
test("invalid service output fails closed instead of emitting unvalidated response", async () => {
  const route = validatedPost(contextRequestSchema, analysisSchema, () => ({ version: 1, topics: ["invalid"], sites: [] }) as any);
  const response = await route(req()); assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: { code: "INTERNAL_ERROR" } });
});
