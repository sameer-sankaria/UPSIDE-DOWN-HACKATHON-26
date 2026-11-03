import type { AccountPreferences } from "./account";
import {completeUsage} from "./account";
import { analysisSchema, contextRequestSchema, ghostRequestSchema, recommendationsSchema,
  isSensitiveUrl, safeOrigin, sanitizeText, type ContextRequest, type Recommendation } from "@navi-os/shared";
import { extractVisibleText } from "./context/extract";
import { observeSession, localGhostSuggestions } from "./ghost/session";
import { emptySession, pruneSession, SESSION_TTL, type AuthorizedTab, type SessionState, type SessionStore } from "./session/state";
import { postBackend } from "./backend/client";
import type { InternalCommand } from "./messaging/internal";

async function urlHash(url: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
}
export class ContextController {
  private requestAbort?: AbortController;
  cancelPendingRequests() { this.requestAbort?.abort(); }
  constructor(private store: SessionStore, private post = postBackend, private now = Date.now) {}
  private async load() { return pruneSession(await this.store.load(), this.now()); }
  private async current() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined || !tab.url || tab.title === undefined || tab.incognito || isSensitiveUrl(tab.url)) {
      throw new Error("Open the popup on a normal, non-sensitive HTTP(S) tab outside incognito mode.");
    }
    return tab as chrome.tabs.Tab & { id: number; url: string; title: string };
  }
  private async authorized(state: SessionState, id: number): Promise<{ grant: AuthorizedTab; tab: chrome.tabs.Tab & { url: string } }> {
    const grant = state.tabs[id];
    if (!grant || grant.expiresAt <= this.now()) throw new Error("Tab metadata permission required.");
    const tab = await chrome.tabs.get(id);
    if (!tab.url || tab.incognito || isSensitiveUrl(tab.url) || safeOrigin(tab.url) !== grant.origin) {
      delete state.tabs[id]; state.pending = [];
      throw new Error("Tab authorization expired or navigation changed origin. Reauthorize this tab.");
    }
    return { grant, tab: tab as chrome.tabs.Tab & { url: string } };
  }
  private stage(state: SessionState, source: "ghost" | "contextflow", recommendations: Recommendation[]) {
    state.pending = state.pending.filter(p => p.source !== source);
    for (const recommendation of recommendations) {
      if (source === "ghost" && state.ghost.dismissed.includes(recommendation.id)) continue;
      state.pending.push({ source, recommendation, expiresAt: this.now() + 5 * 60 * 1000 });
    }
  }
  private observe(state: SessionState) {
    observeSession(state, this.now());
    if (state.ghost.mode === "enabled") this.stage(state, "ghost", localGhostSuggestions(state));
  }
  private view(state: SessionState) {
    return {
      tabs: Object.values(state.tabs).map(t => ({ id: t.id, title: t.title, url: t.url, contentAllowed: !!t.content, expiresAt: t.expiresAt })),
      remoteAIAllowed: state.remoteAIAllowed ?? false, backendAllowed: state.backendAllowed, openTabsAllowed: state.openTabsAllowed,
      assistant: state.assistant ? { token: state.assistant.token, expiresAt: state.assistant.expiresAt, allowManage: state.assistant.allowManage, paired: state.assistant.dashboardTabId !== undefined } : null,
      ghost: { mode: state.ghost.mode, patterns: state.ghost.patterns }, pending: state.pending,
    };
  }
  private async readContent(state: SessionState, ids: number[]) {
    const tabs: ContextRequest["tabs"] = [];
    for (const id of ids) {
      const { grant, tab } = await this.authorized(state, id);
      const consent = grant.content;
      if (!consent || consent.urlHash !== await urlHash(tab.url)) throw new Error("Separate content permission required for each selected tab.");
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: id, documentIds: [consent.documentId] }, world: "ISOLATED", func: extractVisibleText, args: [tab.url],
      });
      if (injection?.documentId !== consent.documentId || injection.frameId !== 0 || !injection.result || injection.result.blocked || typeof injection.result.text !== "string") {
        throw new Error("Extraction blocked: sensitive controls, stale page, or unavailable document.");
      }
      const latest = await this.authorized(state, id);
      if (consent.urlHash !== await urlHash(latest.tab.url)) throw new Error("Page navigated during extraction.");
      tabs.push({ tabId: id, title: sanitizeText(latest.tab.title ?? "", 200), url: grant.origin,
        text: sanitizeText(injection.result.text), capturedAt: this.now() });
    }
    return tabs;
  }
  async captureAssistant(ids: number[]): Promise<ContextRequest["tabs"]> {
    const state = await this.load();
    if (!state.backendAllowed) throw new Error("Connect the local backend in the popup first.");
    if (ids.length > 2 || new Set(ids).size !== ids.length) throw new Error("Select at most two content tabs.");
    const content = await this.readContent(state, ids);
    const tabs: ContextRequest["tabs"] = [];
    for (const id of Object.keys(state.tabs).map(Number)) {
      const { grant, tab } = await this.authorized(state, id);
      tabs.push(content.find(t => t.tabId === id) ?? { tabId: id, title: sanitizeText(tab.title ?? "", 200), url: grant.origin, text: "", capturedAt: this.now() });
    }
    return tabs;
  }
  async applyAccountPreferences(preferences: AccountPreferences) {
    const state=await this.load();state.accountPreferences=preferences;
    if(!preferences.ghost_mode_enabled){state.ghost.mode="disabled";state.ghost.patterns=[];state.pending=state.pending.filter(p=>p.source!=="ghost");}
    if(!preferences.contextflow_enabled)state.pending=state.pending.filter(p=>p.source!=="contextflow");
    await this.store.save(state);
  }
  async dispatch(command: InternalCommand): Promise<unknown> {
    let state = await this.load();
    try {
      if (state.assistant && ["REVOKE_TAB", "REVOKE_CONTENT", "AUTHORIZE_METADATA", "AUTHORIZE_CONTENT", "SET_OPEN_PERMISSION", "SET_AI_CONSENT"].includes(command.type)) {
        delete state.assistant.pending; delete state.assistant.capture;
      }
      switch (command.type) {
        case "ASSISTANT_PAIR": {
          if (!state.backendAllowed) throw new Error("Connect the local backend first.");
          if (command.allowManage && !await chrome.permissions.contains({ permissions: ["tabGroups"] })) throw new Error("Grant optional tab group permission first.");
          const bytes = crypto.getRandomValues(new Uint8Array(32));
          state.assistant = { token: Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""), expiresAt: this.now() + SESSION_TTL, allowManage: command.allowManage, results: [] };
          break;
        }
        case "ASSISTANT_REVOKE": delete state.assistant; await chrome.permissions.remove({ permissions: ["tabs", "tabGroups"] }); break;
        case "STATE": {
          for (const id of Object.keys(state.tabs)) {
            try {
              const { grant, tab } = await this.authorized(state, Number(id));
              grant.title = sanitizeText(tab.title ?? "", 200);
              if (grant.content && grant.content.urlHash !== await urlHash(tab.url)) { delete grant.content; state.pending = []; }
            } catch { delete state.tabs[id]; state.pending = []; }
          }
          break;
        }
        case "AUTHORIZE_METADATA": {
          const tab = await this.current();
          if (!state.tabs[tab.id] && Object.keys(state.tabs).length >= 10) throw new Error("Maximum 10 authorized tabs. Revoke a tab first.");
          const origin = safeOrigin(tab.url);
          state.tabs[tab.id] = { id: tab.id, windowId: tab.windowId, title: sanitizeText(tab.title, 200), url: origin, origin, expiresAt: this.now() + SESSION_TTL };
          state.pending = []; this.observe(state); break;
        }
        case "AUTHORIZE_CONTENT": {
          const current = await this.current();
          const { grant, tab } = await this.authorized(state, current.id);
          // User has separately consented to content access. Bind that consent to this document.
          const [result] = await chrome.scripting.executeScript({ target: { tabId: current.id, frameIds: [0] }, func: () => location.href });
          if (!result?.documentId || result.frameId !== 0 || result.result !== tab.url) throw new Error("Page changed while granting permission. Try again.");
          grant.content = { documentId: result.documentId, urlHash: await urlHash(tab.url) }; break;
        }
        case "REVOKE_TAB": delete state.tabs[command.tabId]; state.pending = []; break;
        case "REVOKE_CONTENT": if (state.tabs[command.tabId]) delete state.tabs[command.tabId]!.content; state.pending = []; break;
        case "CONNECT_BACKEND": {
          if (!await chrome.permissions.contains({ origins: ["http://localhost/*"] })) throw new Error("Local backend permission was not granted.");
          state.backendAllowed = true; break;
        }
        case "SET_AI_CONSENT": state.remoteAIAllowed = command.enabled; break;
        case "SET_OPEN_PERMISSION": state.openTabsAllowed = command.enabled; break;
        case "GHOST_CONTROL": {
          if (command.action === "enable") { if(state.accountPreferences&&!state.accountPreferences.ghost_mode_enabled)throw new Error("Enable the Ghost Mode preference in your website account and sync first."); state.ghost.mode = "enabled"; this.observe(state); }
          else if (command.action === "pause") { state.ghost.mode = "paused"; state.pending = state.pending.filter(p => p.source !== "ghost"); }
          else {
            const mode = command.action === "disable" ? "disabled" : state.ghost.mode === "disabled" ? "disabled" : "paused";
            state.ghost = { ...emptySession().ghost, mode };
            state.pending = state.pending.filter(p => p.source !== "ghost");
          }
          break;
        }
        case "ANALYZE": {
          if(state.accountPreferences?.contextflow_enabled===false)throw new Error("ContextFlow is disabled in your account preferences.");
          if (!state.backendAllowed) throw new Error("Connect the local backend before sending context.");
          const tabs = await this.readContent(state, command.tabIds);
          const body = contextRequestSchema.parse({ version: 1, tabs });
          this.requestAbort = new AbortController();
          const analysis = await this.post("/api/browser-context", body, analysisSchema, false, this.requestAbort.signal);
          const recommendations = await this.post("/api/contextflow", body, recommendationsSchema, state.remoteAIAllowed ?? false, this.requestAbort.signal);
          this.stage(state, "contextflow", recommendations.recommendations);
          await this.store.save(state);
          return { ...this.view(state), analysis };
        }
        case "GHOST_SUGGEST": {
          if (state.ghost.mode !== "enabled") throw new Error("Enable Ghost Mode first.");
          if (!state.backendAllowed) throw new Error("Connect the local backend first.");
          const body = ghostRequestSchema.parse({ version: 1, patterns: state.ghost.patterns });
          this.requestAbort = new AbortController();
          const result = await this.post("/api/ghost/suggestions", body, recommendationsSchema, state.remoteAIAllowed ?? false, this.requestAbort.signal);
          this.stage(state, "ghost", result.recommendations); break;
        }
        case "DISMISS": {
          const pending = state.pending.find(p => p.recommendation.id === command.id);
          if (pending?.source === "ghost") state.ghost.dismissed = [...new Set([...state.ghost.dismissed, command.id])].slice(-16);
          state.pending = state.pending.filter(p => p.recommendation.id !== command.id); break;
        }
        case "OPEN_SELECTED": {
          if (!state.openTabsAllowed || command.approved !== true) throw new Error("Opening tabs requires permission and explicit approval.");
          const pending = state.pending.find(p => p.recommendation.id === command.id && p.expiresAt > this.now());
          if (!pending || (pending.source === "ghost" && state.ghost.mode !== "enabled")) throw new Error("Suggestion unavailable or expired.");
          if (command.indices.some(i => !Number.isInteger(i) || i < 0 || i >= pending.recommendation.queries.length)) throw new Error("Invalid search selection.");
          // Consume and persist approval before opening anything; a replay cannot open more tabs.
          state.pending = state.pending.filter(p => p !== pending);
          await this.store.save(state);
          for (const index of command.indices) {
            const url = new URL("https://www.google.com/search");
            url.searchParams.set("q", pending.recommendation.queries[index]!);
            await chrome.tabs.create({ url: url.href, active: false });
          }
          try{const data=await chrome.storage.session.get("naviUsageReceipt");if(pending.source==="contextflow"&&typeof data.naviUsageReceipt==="string")await completeUsage(data.naviUsageReceipt);}catch{}
          break;
        }
        case "CLEAR_SESSION": {
          state = emptySession(); await this.store.save(state);
          await chrome.permissions.remove({ origins: ["http://localhost/*"], permissions: ["tabs", "tabGroups"] }); break;
        }
      }
      await this.store.save(state);
      return this.view(state);
    } catch (error) { await this.store.save(state); throw error; }
  }
  async updated(id: number, change: { url?: string; title?: string; status?: string }, tab: chrome.tabs.Tab) {
    const state = await this.load(); const grant = state.tabs[id];
    if (!grant) { await this.store.save(state); return; }
    if (change.url !== undefined || change.status === "loading") { delete grant.content; state.pending = []; if (state.assistant) { delete state.assistant.pending; delete state.assistant.capture; } }
    if (change.url && (isSensitiveUrl(change.url) || safeOrigin(change.url) !== grant.origin)) {
      delete state.tabs[id]; state.pending = [];
    } else if (state.ghost.mode === "enabled") {
      if (!tab.url || tab.incognito || isSensitiveUrl(tab.url) || safeOrigin(tab.url) !== grant.origin) { delete state.tabs[id]; state.pending = []; }
      else grant.title = sanitizeText(tab.title ?? grant.title, 200);
      this.observe(state);
    }
    await this.store.save(state);
  }
  async activated(id: number) {
    const state = await this.load();
    if (state.ghost.mode !== "enabled" || !state.tabs[id]) return;
    try {
      const { grant, tab } = await this.authorized(state, id);
      grant.title = sanitizeText(tab.title ?? "", 200); this.observe(state);
    } catch { delete state.tabs[id]; state.pending = []; }
    await this.store.save(state);
  }
  async removed(id: number) {
    const state = await this.load();
    if (state.tabs[id]) { delete state.tabs[id]; state.pending = []; if (state.assistant) { delete state.assistant.pending; delete state.assistant.capture; } }
    await this.store.save(state);
  }
}
