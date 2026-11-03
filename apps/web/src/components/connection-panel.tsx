"use client";

import { useState } from "react";
import { pingExtension } from "../lib/extension-client";

/** Uses only the existing health endpoint and ping-only external bridge. */
export function ConnectionPanel() {
  const [extensionId, setExtensionId] = useState("");
  const [health, setHealth] = useState("Not checked");
  const [connection, setConnection] = useState("Not checked");
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(false);

  async function checkHealth() {
    setCheckingHealth(true);
    setHealth("Checking local backend…");
    try {
      const response = await fetch("/api/health", { cache: "no-store", signal: AbortSignal.timeout(8000) });
      const data: unknown = await response.json();
      if (!response.ok || typeof data !== "object" || data === null || !("status" in data) || data.status !== "ok" || !("app" in data) || data.app !== "NAVI OS") throw new Error("Unexpected health response");
      setHealth("Connected · NAVI OS backend is healthy");
    } catch { setHealth("Unavailable · check that the local web server is running"); }
    finally { setCheckingHealth(false); }
  }

  async function checkExtension(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckingExtension(true);
    setConnection("Checking extension…");
    try {
      await pingExtension(extensionId.trim());
      setConnection("Connected · NAVI_PONG received. Browser state stays in the popup.");
    } catch (error) { setConnection(error instanceof Error ? error.message : "Extension unavailable"); }
    finally { setCheckingExtension(false); }
  }

  return <section className="connection-panel" aria-label="Live connection checks">
    <div className="connection-panel__heading"><span className="navi-eyebrow">LOCAL WORKSPACE / CONNECTION</span><h2>Start with a connection<span aria-hidden="true">.</span></h2><p>Checks run only when you request them. No browser context is read by this panel.</p></div>
    <div className="connection-panel__grid">
      <article><h3>01 / Local backend</h3><p className="connection-status" role="status">{health}</p><button type="button" disabled={checkingHealth} onClick={() => void checkHealth()}>{checkingHealth ? "Checking…" : "Check backend health"}</button></article>
      <article><h3>02 / Chrome extension</h3><form onSubmit={event => void checkExtension(event)}><label htmlFor="extension-id">Chrome extension ID</label><input id="extension-id" name="extensionId" value={extensionId} onChange={event => setExtensionId(event.target.value)} placeholder="32-character ID from chrome://extensions" pattern="[a-p]{32}" required autoComplete="off" spellCheck={false} maxLength={32}/><button disabled={checkingExtension} type="submit">{checkingExtension ? "Checking…" : "Check extension connection"}</button></form><p className="connection-status" role="status">{connection}</p></article>
    </div>
    <div className="connection-panel__states">
      <article><span>ContextFlow</span><h3>Analyze in the popup</h3><p>Select one or two content-authorized tabs to receive real suggestions.</p></article>
      <article><span>Ghost Mode</span><h3>Status available in popup</h3><p>Off by default. Enable, pause, disable, or clear it in the extension.</p></article>
      <article><span>Permissions & context</span><h3>Managed in Chrome</h3><p>Review enrolled tabs, page-text consent, and search approvals there.</p></article>
    </div>
    <p className="connection-panel__note">This diagnostic uses the ping-only connection. The dashboard assistant requires a separate popup-issued pairing grant for authorized context and explicitly approved actions. Manage permissions and Ghost Mode in the extension popup.</p>
  </section>;
}
