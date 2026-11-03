import { isAllowedWebUrl, WEB_ORIGIN, parseBridgeCommand, validatePlanContext, isSensitiveUrl, safeOrigin, type AssistantBridgeCommand, type AssistantGrant, type ActionResult } from "@navi-os/shared";
import { pruneSession, type SessionStore, type SessionState } from "./session/state";
import type { ExternalSender } from "./messaging/external";
import type { ContextController } from "./controller";

async function hash(url: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url))), b => b.toString(16).padStart(2, "0")).join("");
}
export function isDashboardSender(sender: ExternalSender) {
  return sender.id === undefined && sender.tab?.id !== undefined && sender.frameId === 0 && sender.origin === WEB_ORIGIN && isAllowedWebUrl(sender.url) && new URL(sender.url!).pathname === "/dashboard";
}
/** Credentials are minted only by the extension popup; plans never grant privileges. */
export class AssistantEngine {
  private epoch = 0;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private store: SessionStore, private context: Pick<ContextController, "captureAssistant">, private now = Date.now) {}
  stop() { this.epoch++; }
  private async authorize(command: AssistantBridgeCommand, sender: ExternalSender, native=false) {
    if (native ? !(sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL("sidepanel.html")&&!sender.tab) : !isDashboardSender(sender)) throw new Error("Forbidden assistant sender");
    const state = pruneSession(await this.store.load(), this.now()); const grant = native?state.companion:state.assistant;
    if (!grant || grant.token !== command.token || grant.expiresAt <= this.now() || (!native && grant.dashboardTabId !== undefined && grant.dashboardTabId !== sender.tab!.id)) throw new Error("Pair the dashboard from the extension popup again.");
    if (!native && grant.dashboardTabId === undefined) { grant.dashboardTabId = sender.tab!.id; await this.store.save(state); }
    return { state, grant };
  }
  async checkAccess(value:unknown,sender:ExternalSender){await this.authorize(parseBridgeCommand(value),sender);}
  async interrupt(value: unknown, sender: ExternalSender) {
    const command = parseBridgeCommand(value);
    if (command.type !== "NAVI_ASSISTANT_CANCEL") throw new Error("Invalid cancellation");
    await this.authorize(command, sender); this.stop();
  }
  private async checkedTab(state: SessionState, id: number, snapshot?: string) {
    const grant = state.tabs[id];
    if (!grant || grant.expiresAt <= this.now()) throw new Error("Tab permission expired or revoked");
    const tab = await chrome.tabs.get(id);
    if (!tab.url || tab.incognito || isSensitiveUrl(tab.url) || safeOrigin(tab.url) !== grant.origin || (snapshot && await hash(tab.url) !== snapshot)) throw new Error("Tab changed; capture context and replan");
    return tab;
  }
  private async canExecute(state: SessionState, grant: AssistantGrant, index: number) {
    const pending = grant.pending;
    if (!pending || pending.expiresAt <= this.now()) throw new Error("Plan expired");
    const action = pending.actions[index]; if (!action) throw new Error("Invalid action selection");
    if ((action.type === "search" || action.type === "open_tab" || action.type === "open_url") && !state.openTabsAllowed) throw new Error("Enable search/tab opening permission in the popup");
    if (action.type === "close_tab" && !grant.allowClose) throw new Error("Grant separate close-tab permission in the companion");
    if (action.type === "close_tab" && !await chrome.permissions.contains({ permissions: ["tabs"] })) throw new Error("Tab verification permission required");
    if ((action.type === "switch_tab" || action.type === "group_tabs") && !grant.allowManage) throw new Error("Grant switch/group permission in the popup");
    if ((action.type === "search" || action.type === "open_tab" || action.type === "open_url") && !await chrome.permissions.contains({ permissions: ["tabs"] })) throw new Error("Grant optional new-tab destination verification permission in the popup");
    const ids = action.type === "switch_tab" || action.type === "close_tab" ? [action.tabId] : action.type === "group_tabs" ? action.tabIds : Object.keys(pending.snapshots).map(Number);
    for (const id of ids) await this.checkedTab(state, id, pending.snapshots[id]);
    if(action.type==="open_url"&&!grant.approvedUrls?.includes(action.url))throw new Error("Destination was not explicitly requested");
    if (action.type === "open_tab" && !Object.values(state.tabs).some(t => t.origin === action.origin)) throw new Error("Destination origin is not authorized");
    if (action.type === "group_tabs") {
      if (!await chrome.permissions.contains({ permissions: ["tabGroups"] })) throw new Error("Chrome tab group permission required");
      const tabs = await Promise.all(action.tabIds.map(id => this.checkedTab(state, id, pending.snapshots[id])));
      if (new Set(tabs.map(t => t.windowId)).size !== 1) throw new Error("Grouping supports tabs in one window only");
    }
    return action;
  }
  async handle(value:unknown,sender:ExternalSender){return this.run(value,sender,false);}
  async handleNative(value:unknown,sender:ExternalSender){return this.run(value,sender,true);}
  private run(value: unknown, sender: ExternalSender,native:boolean) {
    const scheduledEpoch = this.epoch;
    const next = this.queue.then(() => {
      if (parseBridgeCommand(value).type === "NAVI_ASSISTANT_EXECUTE" && scheduledEpoch !== this.epoch) throw new Error("Execution cancelled before it started");
      return this.perform(value,sender,native);
    });
    this.queue = next.catch(() => undefined); return next;
  }
  private async perform(value: unknown, sender: ExternalSender,native:boolean) {
    const command = parseBridgeCommand(value); const startEpoch = this.epoch; const { state, grant } = await this.authorize(command, sender,native);
    if (command.type === "NAVI_ASSISTANT_CONTEXT") {
      if(native&&command.contentTabIds.length>1)throw new Error("Summarize only one authorized page at a time");
      const tabs = await this.context.captureAssistant(command.contentTabIds);
      const snapshots: Record<string, string> = {};
      for (const tab of tabs) snapshots[tab.tabId] = await hash((await this.checkedTab(state, tab.tabId)).url!);
      grant.capture = { id: crypto.randomUUID(), snapshots, expiresAt: this.now() + 5 * 60000 };
      delete grant.pending; await this.store.save(state);
      return { tabs, contextId: grant.capture.id, ghostMode: state.ghost.mode };
    }
    if (command.type === "NAVI_ASSISTANT_VALIDATE") {
      if (!state.backendAllowed || !grant.capture || grant.capture.id !== command.contextId || grant.capture.expiresAt <= this.now()) throw new Error("Context expired or permissions changed. Capture context again.");
      for (const [id, snapshot] of Object.entries(grant.capture.snapshots)) await this.checkedTab(state, Number(id), snapshot);
      return { valid: true };
    }
    if (command.type === "NAVI_ASSISTANT_STATUS") return { results: grant.results, pendingId: grant.pending?.id ?? null };
    if (command.type === "NAVI_ASSISTANT_CANCEL") {
      this.stop(); delete grant.pending; delete grant.capture; await this.store.save(state); return { cancelled: true, results: grant.results };
    }
    if (command.type === "NAVI_ASSISTANT_STAGE") {
      this.stop();
      const tabs = await this.context.captureAssistant([]);
      if(native){
        if(command.plan.actions.length>1)throw new Error("Only one companion action");
        for(const action of command.plan.actions){
          if(action.type==="open_url"){if(!grant.approvedUrls?.includes(action.url))throw new Error("Destination not requested");}
          else if(action.type==="switch_tab" || action.type==="close_tab"){if(!tabs.some(t=>t.tabId===action.tabId))throw new Error("Tab not authorized");}
          else if(action.type!=="search")throw new Error("Unsupported companion action");
        }
      }else validatePlanContext(command.plan, tabs);
      if (!grant.capture || grant.capture.id !== command.contextId || grant.capture.expiresAt <= this.now()) throw new Error("Capture context before planning");
      const snapshots = grant.capture.snapshots;
      for (const [id, snapshot] of Object.entries(snapshots)) await this.checkedTab(state, Number(id), snapshot);
      if (tabs.length !== Object.keys(snapshots).length) throw new Error("Authorized tabs changed; capture context again");
      grant.pending = { id: crypto.randomUUID(), mode: "DO_IT", actions: command.plan.actions, snapshots, expiresAt: this.now() + 5 * 60000 };
      grant.results = []; await this.store.save(state);
      return { planId: grant.pending.id, expiresAt: grant.pending.expiresAt };
    }
    if (!grant.pending || grant.pending.id !== command.planId) throw new Error("Plan unavailable or already consumed");
    // Check the whole approved subset before any changes. Persist consumption before execution.
    const actions = [];
    for (const index of command.indices) actions.push({ index, action: await this.canExecute(state, grant, index) });
    const epoch = startEpoch; const snapshots = grant.pending.snapshots; delete grant.pending; grant.results = []; await this.store.save(state);
    for (const { index, action } of actions) {
      if (epoch !== this.epoch) { grant.results.push({ index, status: "cancelled", detail: "Stopped before execution" }); continue; }
      try {
        // Re-check URL and session grants immediately before each irreversible browser call.
        const latest = await this.authorize(command, sender,native);
        if (latest.grant.token !== grant.token) throw new Error("Permission revoked");
        if ((action.type === "search" || action.type === "open_tab" || action.type === "open_url") && !latest.state.openTabsAllowed) throw new Error("Opening permission revoked");
        if (action.type === "close_tab") {
          if (!native || !latest.grant.allowClose || !await chrome.permissions.contains({permissions:["tabs"]})) throw new Error("Closing permission revoked");
          await this.checkedTab(latest.state,action.tabId,snapshots[action.tabId]);
        }
        if (action.type === "switch_tab" || action.type === "group_tabs") {
          if (!latest.grant.allowManage) throw new Error("Management permission revoked");
          for (const id of action.type === "switch_tab" ? [action.tabId] : action.tabIds) await this.checkedTab(latest.state, id, snapshots[id]);
        }
        if (action.type === "search" || action.type === "open_tab" || action.type === "open_url") {
          for (const id of Object.keys(snapshots).map(Number)) await this.checkedTab(latest.state, id, snapshots[id]);
          if (action.type === "open_tab" && !Object.values(latest.state.tabs).some(t => t.origin === action.origin)) throw new Error("Origin revoked");
        }
        if ((action.type === "search" || action.type === "open_tab" || action.type === "open_url") && !await chrome.permissions.contains({ permissions: ["tabs"] })) throw new Error("New-tab verification permission revoked");
        if (action.type === "group_tabs" && !await chrome.permissions.contains({ permissions: ["tabGroups"] })) throw new Error("Group permission revoked");
        if (epoch !== this.epoch) { grant.results.push({ index, status: "cancelled", detail: "Stopped before execution" }); continue; }
        if (action.type === "search" || action.type === "open_tab" || action.type === "open_url") {
          const url = action.type === "search" ? `https://www.google.com/search?q=${encodeURIComponent(action.query)}` : action.type==="open_url"?action.url:action.origin;
          const created = await chrome.tabs.create({ url, active: false });
          if (created.id === undefined) throw new Error("Chrome did not return a tab ID");
          const verified = await chrome.tabs.get(created.id);
          if (verified.incognito || (verified.pendingUrl ?? verified.url) !== new URL(url).href) throw new Error("New tab destination could not be verified");
        } else if (action.type === "close_tab") {
          await chrome.tabs.remove(action.tabId);
          if ((await chrome.tabs.query({})).some(t => t.id === action.tabId)) throw new Error("Tab closure could not be verified");
        } else if (action.type === "switch_tab") {
          await chrome.tabs.update(action.tabId, { active: true });
          if (!(await chrome.tabs.get(action.tabId)).active) throw new Error("Active tab could not be verified");
        } else {
          const tabIds: [number, ...number[]] = [action.tabIds[0]!, ...action.tabIds.slice(1)];
          const groupId = await chrome.tabs.group({ tabIds });
          // The action is already in flight: stop suppresses further work, but cannot undo grouping.
          await chrome.tabGroups.update(groupId, { title: action.title });
          if ((await chrome.tabGroups.get(groupId)).title !== action.title) throw new Error("Group title could not be verified");
          for (const id of action.tabIds) if ((await chrome.tabs.get(id)).groupId !== groupId) throw new Error("Group membership could not be verified");
        }
        grant.results.push({ index, status: "verified", detail: "Chrome confirmed the requested browser state; page loading/content is not verified." });
      } catch { grant.results.push({ index, status: "failed", detail: "Action failed or state could not be verified. Inspect Chrome before retrying." }); this.stop(); }
      // Keep a bounded session-only action log, with no page text or URLs.
      const latest = await this.store.load();
      const saved=native?latest.companion:latest.assistant;
      if(saved?.token===grant.token){saved.results=grant.results.slice(-5);await this.store.save(latest);}
    }
    const finalState = await this.store.load();
    const finalGrant=native?finalState.companion:finalState.assistant;
    if(finalGrant?.token===grant.token){finalGrant.results=grant.results.slice(-5);await this.store.save(finalState);}
    return { results: grant.results as ActionResult[] };
  }
}
