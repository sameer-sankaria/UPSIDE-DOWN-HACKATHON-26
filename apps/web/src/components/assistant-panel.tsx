"use client";
import { useEffect, useRef, useState } from "react";
import { assistantMessage } from "../lib/assistant-client";
import { assistantRequestSchema, assistantResponseSchema, type AssistantMode, type AssistantResponse, type ActionResult, type TabContext, type PlannedAction } from "@navi-os/shared";

function describe(action: PlannedAction) {
  switch (action.type) {
    case "open_url": return `Open approved HTTPS URL: ${action.url}`;
    case "search": return `Search Google: ${action.query}`;
    case "open_tab": return `Open new tab: ${action.origin}`;
    case "switch_tab": return `Switch to authorized tab #${action.tabId}`;
    case "group_tabs": return `Group tabs ${action.tabIds.join(", ")} as “${action.title}”`;
  }
}
export function AssistantPanel() {
  const [id, setId] = useState(""); const [token, setToken] = useState("");
  const [mode, setMode] = useState<AssistantMode>("SHOW_ME"); const [instruction, setInstruction] = useState("");
  const [tabs, setTabs] = useState<TabContext[]>([]); const [contentIds, setContentIds] = useState<number[]>([]);
  const [contextId, setContextId] = useState(""); const [consent, setConsent] = useState(false);
  const [response, setResponse] = useState<AssistantResponse | null>(null); const [planId, setPlanId] = useState("");
  const [selected, setSelected] = useState<number[]>([]); const [results, setResults] = useState<ActionResult[]>([]);
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState("Pair the dashboard from the extension popup to use authorized context.");
  const receipt=useRef<string|null>(null);
  useEffect(()=>{void fetch("/api/account",{cache:"no-store"}).then(async r=>{if(r.ok){const data=await r.json();if(["SHOW_ME","DO_IT"].includes(data.preferences?.preferred_ai_mode))setMode(data.preferences.preferred_ai_mode);}}).catch(()=>undefined);},[]);
  const abort = useRef<AbortController | null>(null); const generation = useRef(0);
  const message = async <T,>(command: Parameters<typeof assistantMessage>[1]) => {
    if(command.type!=="NAVI_ASSISTANT_CANCEL"){
      const linked=await fetch("/api/account/link",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pairingToken:token.trim()})});
      if(!linked.ok)throw new Error("Sign in to the same account in the website and extension before pairing.");
    }
    return assistantMessage<T>(id.trim(),command);
  };
  useEffect(() => () => { generation.current++; abort.current?.abort(); }, []);
  function resetPlan() { setResponse(null); setPlanId(""); setSelected([]); setResults([]); }
  async function capture(readContent = false) {
    const run = ++generation.current; setBusy(true); resetPlan();
    try {
      const data = await message<{ tabs: TabContext[]; contextId: string }>({ type: "NAVI_ASSISTANT_CONTEXT", token: token.trim(), contentTabIds: readContent ? contentIds : [] });
      const parsed = assistantRequestSchema.parse({ version: 1, instruction: "Read authorized context", mode, tabs: data.tabs });
      if (run !== generation.current) return;
      setTabs(parsed.tabs); setConsent(false); setContextId(data.contextId); setStatus(`Captured ${parsed.tabs.length} authorized tab(s). ${readContent ? "Permitted page text included." : "Metadata only; no page text read."}`);
    } catch (error) { if (run === generation.current) setStatus(error instanceof Error ? error.message : "Context capture failed"); }
    finally { if (run === generation.current) setBusy(false); }
  }
  async function plan(event: React.FormEvent) {
    event.preventDefault(); const run = ++generation.current; resetPlan(); setBusy(true); setStatus("Generating a plan…");
    const controller = new AbortController(); abort.current = controller;
    try {
      if (tabs.length && !consent) throw new Error("Consent to send this captured context to Google Gemini before planning.");
      if (contextId) await message({ type: "NAVI_ASSISTANT_VALIDATE", token: token.trim(), contextId });
      if (run !== generation.current) return;
      const input = assistantRequestSchema.parse({ version: 1, mode, instruction, tabs });
      const result = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: controller.signal });
      if (!result.ok) throw new Error(`Assistant request failed (${result.status}).`);
      receipt.current=result.headers.get("x-navi-usage-receipt");
      const data = assistantResponseSchema.parse(await result.json());
      if (run !== generation.current) return;
      setResponse(data); setStatus(data.provider === "gemini" ? "Plan ready. Nothing has executed." : data.notice);
      if (mode === "DO_IT" && data.plan.actions.length) {
        if (!contextId) throw new Error("Plan ready. Pair and capture authorized metadata before staging browser actions.");
        const staged = await message<{ planId: string }>({ type: "NAVI_ASSISTANT_STAGE", token: token.trim(), contextId, mode, plan: data.plan });
        if (run === generation.current) setPlanId(staged.planId);
      }
    } catch (error) { if (run === generation.current) setStatus(error instanceof Error ? error.message : "Planning failed"); }
    finally { if (run === generation.current) setBusy(false); }
  }
  async function execute() {
    const run = ++generation.current; setBusy(true); setStatus("Executing approved actions…");
    const pendingId = planId; setPlanId("");
    try {
      const data = await message<{ results: ActionResult[] }>({ type: "NAVI_ASSISTANT_EXECUTE", token: token.trim(), planId: pendingId, indices: selected, approved: true });
      if(receipt.current&&data.results.some(r=>r.status==="verified")){void fetch("/api/usage/complete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({receipt:receipt.current})}).catch(()=>undefined);receipt.current=null;}
      if (run === generation.current) { setResults(data.results); setStatus(data.results.every(r => r.status === "verified") ? "Approved actions verified by Chrome." : "Execution finished with failures or stopped actions. Review the results."); }
    } catch (error) { if (run === generation.current) setStatus(error instanceof Error ? error.message : "Execution failed"); }
    finally { if (run === generation.current) setBusy(false); }
  }
  async function stop() {
    generation.current++; abort.current?.abort(); setBusy(false); setPlanId(""); setSelected([]); setTabs([]); setContextId(""); setConsent(false); setStatus("Planning stopped locally. Requesting extension cancellation…");
    try {
      const data = await message<{ results: ActionResult[] }>({ type: "NAVI_ASSISTANT_CANCEL", token: token.trim() });
      setResults(data.results); setStatus("Pending plan rejected; extension stop confirmed. An action already sent to Chrome cannot be undone.");
    } catch { setStatus("Planning stopped locally. Extension cancellation could not be confirmed; inspect Chrome and revoke dashboard access in the popup."); }
  }
  return <section className="assistant-panel" aria-labelledby="assistant-title">
    <span className="navi-eyebrow">NAVI ASSISTANT / APPROVAL BEFORE ACTION</span><h2 id="assistant-title">What would you like to do?</h2>
    <p>Gemini plans. You approve. Chrome executes only the supported actions. SHOW ME never executes changes.</p>
    <div className="assistant-pair"><label>Extension ID<input value={id} disabled={busy} onChange={e => { setId(e.target.value); setTabs([]); setContextId(""); resetPlan(); }} autoComplete="off" spellCheck={false} placeholder="32-character Chrome extension ID" /></label><label>Session pairing token<input type="password" value={token} disabled={busy} onChange={e => { setToken(e.target.value); setTabs([]); setContextId(""); resetPlan(); }} autoComplete="off" placeholder="Generate in the NAVI extension popup" /></label></div>
    <p className="assistant-hint">In the popup: connect the backend, authorize your tabs, then enable dashboard pairing. Switch/group access, opening tabs, and destination verification are separate permissions. The token binds to this dashboard tab and expires after 30 minutes.</p>
    <button disabled={busy || !token} onClick={() => void capture()}>Read authorized tab metadata</button>
    {!!tabs.length && <fieldset><legend>Authorized context — select at most two tabs for permitted page text</legend>{tabs.map(tab => <label key={tab.tabId}><input type="checkbox" disabled={busy} checked={contentIds.includes(tab.tabId)} onChange={e => setContentIds(ids => e.target.checked ? [...ids, tab.tabId].slice(-2) : ids.filter(id => id !== tab.tabId))} /> #{tab.tabId} {tab.title} · {tab.url} {tab.text ? `· ${tab.text.length} sanitized characters` : "· metadata only"}</label>)}<button disabled={busy || !contentIds.length} onClick={() => void capture(true)}>Read selected permitted page content</button><p>Page text requires separate per-document permission in the popup. No form or password fields are collected.</p></fieldset>}
    <form onSubmit={event => void plan(event)}>
      <label>Interaction mode<select disabled={busy} value={mode} onChange={e => { setMode(e.target.value as AssistantMode); resetPlan(); }}><option value="SHOW_ME">SHOW ME — explanation only</option><option value="DO_IT">DO IT — approve selected actions</option></select></label>
      <label>Your instruction<textarea required maxLength={2000} disabled={busy} value={instruction} onChange={e => { setInstruction(e.target.value); resetPlan(); }} placeholder="Summarize my permitted page, organize authorized tabs by topic, or search for React tutorials." /></label>
      <label><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} /> I consent to send the displayed authorized metadata and any captured page text to Google Gemini for this request.</label>
      <button disabled={busy || !instruction.trim()} type="submit">{busy ? "Working…" : "Generate plan"}</button>
      <button type="button" onClick={() => void stop()}>Stop / reject pending plan</button>
    </form>
    <p role="status" aria-live="polite" className="assistant-status">{status}</p>
    {response && <article className="assistant-plan"><span className="navi-eyebrow">{response.provider.toUpperCase()} / {mode.replace("_", " ")}</span><h3>Proposed plan</h3><p>{response.plan.summary}</p><ol>{response.plan.steps.map((step, i) => <li key={i}>{step}</li>)}</ol><p>{response.notice}</p>{response.plan.actions.map((action, index) => <label className="assistant-action" key={index}>{mode === "DO_IT" && <input type="checkbox" disabled={busy || !planId} checked={selected.includes(index)} onChange={e => setSelected(ids => e.target.checked ? [...ids, index] : ids.filter(i => i !== index))} />} {describe(action)}</label>)}{mode === "DO_IT" && !!response.plan.actions.length && <button disabled={busy || !planId || !selected.length} onClick={() => void execute()}>Approve and execute {selected.length} selected action(s)</button>}{mode === "SHOW_ME" && <p>Explanation only. No browser-changing actions can execute in this mode.</p>}</article>}
    <button disabled={busy || !token} onClick={() => {
      setBusy(true);
      void message<{ results: ActionResult[] }>({ type: "NAVI_ASSISTANT_STATUS", token: token.trim() }).then(data => { setResults(data.results); setStatus("Session action log loaded."); }, () => setStatus("Session log unavailable; check your pairing.")).finally(() => setBusy(false));
    }}>Read session action log</button>
    {!!results.length && <article><h3>Execution results</h3><ul>{results.map(r => <li key={r.index}>Action {r.index + 1} · {r.status}: {r.detail}</li>)}</ul></article>}
    <p className="assistant-hint">Supported: authorized metadata, permitted text summaries, Google search, opening an enrolled origin, switching enrolled tabs, and grouping enrolled tabs in one window. No forms, purchases, tab closing, or arbitrary scripts. Logs last only for this browser session.</p>
  </section>;
}
