import { WEB_ORIGIN, type Schema } from "@navi-os/shared";
export async function postBackend<I, O>(path: string, body: I, schema: Schema<O>): Promise<O> {
  if (!await chrome.permissions.contains({ origins: ["http://localhost/*"] })) throw new Error("Connect the local backend first.");
  if (!["/api/browser-context", "/api/contextflow", "/api/ghost/suggestions"].includes(path)) throw new Error("Unknown endpoint");
  const response = await fetch(WEB_ORIGIN + path, {
    method: "POST", headers: { "Content-Type": "application/json", "X-Navi-Extension-Id": chrome.runtime.id },
    body: JSON.stringify(body), credentials: "omit", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Backend returned ${response.status}. Check NAVI_EXTENSION_ID and restart the web app.`);
  // Bound responses even if a local server is misconfigured.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing backend response");
  let text = ""; let bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.length;
      if (bytes > 32768) { await reader.cancel(); throw new Error("Backend response too large"); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  return schema.parse(JSON.parse(text));
}
