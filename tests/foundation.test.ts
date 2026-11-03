import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { isAllowedWebUrl, isPingMessage, isPongMessage, WEB_ORIGIN } from "@navi-os/shared";
import { handleExternalMessage } from "../apps/extension/src/messaging/external";
import { readAuthorizedActiveTab } from "../apps/extension/src/browser/tabs";
import { pingExtension } from "../apps/web/src/lib/extension-client";
import { GET } from "../apps/web/src/app/api/health/route";

const ping = { version: 1, type: "NAVI_PING", requestId: "test-123" };
const sender = { url: WEB_ORIGIN + "/", origin: WEB_ORIGIN, frameId: 0, tab: { id: 1 } };

test("health handler returns exact contract and no-store", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok", app: "NAVI OS" });
});
test("local app ping returns correlated pong", () => {
  assert.deepEqual(handleExternalMessage(ping, sender), {
    version: 1, type: "NAVI_PONG", requestId: "test-123", app: "NAVI OS",
  });
});
for (const url of ["https://evil.test", "http://localhost:3001", "http://localhost.evil.test:3000", "http://127.0.0.1:3000", "https://localhost:3000", "http://user:password@localhost:3000", "invalid"]) {
  test(`reject origin ${url}`, () => {
    assert.equal(isAllowedWebUrl(url), false);
    assert.equal(handleExternalMessage(ping, { ...sender, url }).type, "NAVI_ERROR");
  });
}
for (const override of [{ origin: "null" }, { origin: undefined }, { frameId: 1 }, { frameId: undefined }, { tab: undefined }, { id: "another-extension" }]) {
  test(`reject sender ${JSON.stringify(override)}`, () => {
    assert.deepEqual(handleExternalMessage(ping, { ...sender, ...override }), { version: 1, type: "NAVI_ERROR", code: "FORBIDDEN" });
  });
}
for (const message of [null, [], "ping", { ...ping, version: 2 }, { ...ping, type: "BROWSER_NAVIGATE" }, { ...ping, requestId: "" }, { ...ping, requestId: "x".repeat(65) }, { ...ping, script: "alert(1)" }]) {
  test(`reject malformed/unsupported message ${JSON.stringify(message)}`, () => {
    assert.equal(isPingMessage(message), false);
    assert.deepEqual(handleExternalMessage(message, sender), { version: 1, type: "NAVI_ERROR", code: "INVALID_MESSAGE" });
  });
}
test("manifest retains core permissions and adds Side Panel without unrestricted page access", async () => {
  const manifest = JSON.parse(await readFile(new URL("../apps/extension/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting", "storage", "sidePanel"]);
  assert.deepEqual(manifest.optional_host_permissions, ["http://localhost/*"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.externally_connectable, { matches: ["http://localhost/*"] });
});
test("tab adapter returns only authorized metadata and fails closed", async () => {
  const tab = { id: 42, windowId: 1, title: "Example", url: "https://example.com/", secret: "not returned" };
  const global = globalThis as any;
  global.chrome = { tabs: { query: async (query: unknown) => {
    assert.deepEqual(query, { active: true, currentWindow: true });
    return [tab];
  } } };
  try {
    assert.deepEqual(await readAuthorizedActiveTab(), { id: 42, windowId: 1, title: "Example", url: "https://example.com/" });
    global.chrome.tabs.query = async () => [{ id: 42 }];
    await assert.rejects(readAuthorizedActiveTab(), /metadata unavailable/);
    global.chrome.tabs.query = async () => [{ ...tab, url: "chrome://extensions" }];
    await assert.rejects(readAuthorizedActiveTab(), /HTTP/);
  } finally { delete global.chrome; }
});
test("web client exchanges a ping through mocked Chrome transport and rejects bad responses", async () => {
  const global = globalThis as any;
  const runtime: any = { sendMessage: (_id: string, message: unknown, cb: (value: unknown) => void) => cb(handleExternalMessage(message, sender)) };
  global.window = { location: { href: WEB_ORIGIN }, chrome: { runtime } };
  try {
    assert.equal(isPongMessage(await pingExtension("a".repeat(32))), true);
    await assert.rejects(pingExtension("bad-id"), /Invalid Chrome/);
    runtime.sendMessage = (_id: string, _message: unknown, cb: (value: unknown) => void) => cb({ version: 1, type: "NAVI_PONG", requestId: "wrong", app: "NAVI OS" });
    await assert.rejects(pingExtension("a".repeat(32)), /Invalid extension response/);
    runtime.lastError = { message: "Extension unavailable" };
    await assert.rejects(pingExtension("a".repeat(32)), /Extension unavailable/);
    global.window.location.href = "https://evil.test";
    await assert.rejects(pingExtension("a".repeat(32)), /localhost/);
  } finally { delete global.window; }
});
