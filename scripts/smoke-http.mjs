import assert from "node:assert/strict";
const base = process.env.NAVI_TEST_BASE_URL ?? "http://localhost:3000";
const webOrigin="http://localhost:3000";
const context = { version: 1, tabs: [
  { tabId: 1, title: "React repository", url: "https://github.com", text: "React hooks", capturedAt: Date.now() },
  { tabId: 2, title: "React documentation", url: "https://react.dev", text: "React components", capturedAt: Date.now() },
] };
async function post(path, body, origin = webOrigin) {
  return fetch(base + path, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
}
const health = await fetch(base + "/api/health");
assert.equal(health.status, 200); assert.deepEqual(await health.json(), { status: "ok", app: "NAVI OS" });
assert.equal(health.headers.get("cache-control"), "no-store");
const home = await fetch(base + "/"); assert.equal(home.status, 200); assert.ok((await home.text()).includes("Your browser. Your AI. Your control."));
const dashboard = await fetch(base + "/dashboard",{redirect:"manual"}); assert.equal(dashboard.status, 307); assert.ok(dashboard.headers.get("location").includes("/login"));
const admin = await fetch(base + "/admin",{redirect:"manual"}); assert.equal(admin.status,307); assert.ok(admin.headers.get("location").includes("/login"));
const login=await fetch(base+"/login");assert.equal(login.status,200);assert.ok((await login.text()).includes("Log in"));
assert.equal((await fetch(base+"/api/account")).status,401);
assert.equal((await fetch(base+"/api/extension/session")).status,401);
for (const path of ["/onda/template.css", "/onda/navi.css", "/onda/motion.js", "/onda/LICENSE", "/onda/CREDITS.md", "/onda/browser.svg", "/icon.svg"]) {
  const asset = await fetch(base + path); assert.equal(asset.status, 200, path); assert.ok((await asset.text()).length > 0, path);
}
const analysis = await post("/api/browser-context", context); assert.equal(analysis.status, 200);
assert.ok((await analysis.json()).topics.includes("react"));
const flow = await post("/api/contextflow", context); assert.equal(flow.status, 200);
const recommendations = (await flow.json()).recommendations; assert.equal(recommendations[0].requiresApproval, true);
assert.ok(recommendations[0].queries.every(q => q.includes("react")));
const ghost = await post("/api/ghost/suggestions", { version: 1, patterns: [{ sites: ["github", "documentation", "stackoverflow"], topics: ["react"], count: 2, lastSeenAt: Date.now() }] });
assert.equal(ghost.status, 200); assert.equal((await ghost.json()).recommendations[0].requiresApproval, true);
const assistant = await post("/api/assistant", { version: 1, mode: "SHOW_ME", instruction: "Explain which browser actions need approval", tabs: [] });
assert.equal(assistant.status, 200);
const assistantBody = await assistant.json(); assert.equal(assistantBody.version, 1); assert.ok(["gemini", "fallback"].includes(assistantBody.provider));
assert.ok(Array.isArray(assistantBody.plan.actions));
for (const path of ["/api/browser-context", "/api/contextflow", "/api/ghost/suggestions", "/api/assistant"]) {
  const blocked = await post(path, context, "https://evil.example"); assert.equal(blocked.status, 403);
  assert.equal(blocked.headers.has("access-control-allow-origin"), false);
  assert.equal((await post(path, { version: 99 })).status, 400);
}
console.log("PASS: live homepage, dashboard, landing assets, health, assistant and three intelligence endpoints, relevant queries, approval flags, rejected origins and invalid schemas.");
