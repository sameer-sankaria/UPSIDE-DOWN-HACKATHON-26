import type { InternalCommand } from "./messaging/internal";
import type { Pattern } from "@navi-os/shared";
import type { Pending } from "./session/state";
interface View {
  tabs: { id: number; title: string; url: string; contentAllowed: boolean; expiresAt: number }[];
  backendAllowed: boolean; openTabsAllowed: boolean;
  ghost: { mode: string; patterns: Pattern[] }; pending: Pending[]; analysis?: unknown;
}
const element = (id: string) => document.getElementById(id)!;
const status = element("result");
let busy = false;
function render(view: View) {
  const selected = new Set(Array.from(document.querySelectorAll<HTMLInputElement>('input[name="tab"]:checked')).map(i => Number(i.value)));
  element("tabs").replaceChildren();
  for (const tab of view.tabs) {
    const p = document.createElement("p"); const label = document.createElement("label");
    const input = document.createElement("input"); input.type = "checkbox"; input.name = "tab"; input.value = String(tab.id); input.checked = selected.has(tab.id);
    label.append(input, ` ${tab.title} — ${tab.url} (page text ${tab.contentAllowed ? "allowed" : "not allowed"}) `);
    const revoke = document.createElement("button"); revoke.textContent = "Revoke";
    revoke.onclick = () => { void run({ type: "REVOKE_TAB", tabId: tab.id }); };
    p.append(label, revoke);
    if (tab.contentAllowed) {
      const revokeContent = document.createElement("button"); revokeContent.textContent = "Revoke page text";
      revokeContent.onclick = () => { void run({ type: "REVOKE_CONTENT", tabId: tab.id }); }; p.append(revokeContent);
    }
    element("tabs").append(p);
  }
  element("connection").textContent = `Backend consent: ${view.backendAllowed ? "connected" : "not connected"}`;
  element("ghost-state").textContent = `Ghost Mode: ${view.ghost.mode}; ${view.ghost.patterns.length} aggregate pattern(s).`;
  (element("open-permission") as HTMLInputElement).checked = view.openTabsAllowed;
  element("suggestions").replaceChildren();
  for (const pending of view.pending) {
    const s = pending.recommendation; const box = document.createElement("fieldset");
    const legend = document.createElement("legend"); legend.textContent = `${s.title} (${Math.round(s.confidence * 100)}% heuristic confidence)`;
    const reason = document.createElement("p"); reason.textContent = s.reason;
    box.append(legend, reason);
    const selections: HTMLInputElement[] = [];
    s.queries.forEach((query, index) => {
      const row = document.createElement("p"); const label = document.createElement("label"); const check = document.createElement("input");
      check.type = "checkbox"; check.value = String(index); selections.push(check); label.append(check, ` ${query}`); row.append(label); box.append(row);
    });
    const approve = document.createElement("button");
    approve.textContent = s.kind === "workspace" ? "Prepare Workspace — approve opening selected searches" : "Approve opening selected search queries";
    approve.onclick = () => { void run({ type: "OPEN_SELECTED", id: s.id, indices: selections.filter(i => i.checked).map(i => Number(i.value)), approved: true }); };
    const dismiss = document.createElement("button"); dismiss.textContent = "Not Now";
    dismiss.onclick = () => { void run({ type: "DISMISS", id: s.id }); };
    box.append(approve, dismiss); element("suggestions").append(box);
  }
  if (view.analysis) status.textContent = JSON.stringify(view.analysis, null, 2);
}
async function run(command: InternalCommand) {
  if (busy) return;
  busy = true;
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button,input"));
  buttons.forEach(b => { b.disabled = true; });
  status.textContent = "Working…";
  try {
    const response = await chrome.runtime.sendMessage(command);
    if (!response?.ok) throw new Error(response?.error ?? "Command failed");
    status.textContent = "Done."; render(response.data as View);
  } catch (error) { status.textContent = error instanceof Error ? error.message : "Command failed"; }
  finally { busy = false; buttons.forEach(b => { b.disabled = false; }); }
}
element("metadata").onclick = () => { void run({ type: "AUTHORIZE_METADATA" }); };
element("content").onclick = () => { void run({ type: "AUTHORIZE_CONTENT" }); };
element("refresh").onclick = () => { void run({ type: "STATE" }); };
element("clear-session").onclick = () => { void run({ type: "CLEAR_SESSION" }); };
element("analyze").onclick = () => {
  const tabIds = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="tab"]:checked')).map(i => Number(i.value));
  if (tabIds.length < 1 || tabIds.length > 2) { status.textContent = "Select one or two content-authorized tabs."; return; }
  void run({ type: "ANALYZE", tabIds });
};
for (const action of ["enable", "pause", "disable", "clear"] as const) element(action).onclick = () => { void run({ type: "GHOST_CONTROL", action }); };
element("ghost-fetch").onclick = () => { void run({ type: "GHOST_SUGGEST" }); };
(element("open-permission") as HTMLInputElement).onchange = event => {
  void run({ type: "SET_OPEN_PERMISSION", enabled: (event.target as HTMLInputElement).checked });
};
element("connect").onclick = () => {
  // Must be invoked synchronously from this user gesture; no wildcard website grant.
  void chrome.permissions.request({ origins: ["http://localhost/*"] }).then(granted => {
    if (granted) return run({ type: "CONNECT_BACKEND" });
    status.textContent = "Backend permission declined.";
  }).catch(() => { status.textContent = "Backend permission request failed."; });
};
void run({ type: "STATE" });
