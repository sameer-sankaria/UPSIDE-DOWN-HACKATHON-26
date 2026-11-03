import assert from "node:assert/strict";
const base = "http://localhost:3000";
const context = { version: 1, tabs: [
  { tabId: 1, title: "React repository", url: "https://github.com", text: "React hooks", capturedAt: Date.now() },
  { tabId: 2, title: "React documentation", url: "https://react.dev", text: "React components", capturedAt: Date.now() },
] };
async function post(path, body, origin = base) {
  return fetch(base + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
}
const health = await fetch(base + "/api/health");
assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: "ok", app: "NAVI OS" });
assert.equal(health.headers.get("cache-control"), "no-store");
const home = await fetch(base + "/"); assert.equal(home.status, 200); assert.ok((await home.text()).includes("NAVI OS — Phase 1 foundation."));
const analysis = await post("/api/browser-context", context); assert.equal(analysis.status, 200);
assert.ok((await analysis.json()).topics.includes("react"));
const flow = await post("/api/contextflow", context); assert.equal(flow.status, 200);
const recommendations = (await flow.json()).recommendations; assert.equal(recommendations[0].requiresApproval, true);
assert.ok(recommendations[0].queries.every(q => q.includes("react")));
const ghost = await post("/api/ghost/suggestions", { version: 1, patterns: [{ sites: ["github", "documentation", "stackoverflow"], topics: ["react"], count: 2, lastSeenAt: Date.now() }] });
assert.equal(ghost.status, 200); assert.equal((await ghost.json()).recommendations[0].requiresApproval, true);
for (const path of ["/api/browser-context", "/api/contextflow", "/api/ghost/suggestions"]) {
  const blocked = await post(path, context, "https://evil.example"); assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.has("access-control-allow-origin"), false);
  assert.equal((await post(path, { version: 99 })).status, 400);
}
console.log("PASS: live homepage, health, three intelligence endpoints, relevant queries, approval flags, rejected origins and invalid schemas.");
