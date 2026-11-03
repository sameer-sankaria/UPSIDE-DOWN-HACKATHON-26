import type { AccountPreferences } from "../account";
import { isRecord, type BrowserTab, type Pattern, type Recommendation, type AssistantGrant } from "@navi-os/shared";
export const SESSION_TTL = 30 * 60 * 1000;
export interface AuthorizedTab extends BrowserTab {
  origin: string;
  expiresAt: number;
  content?: { documentId: string; urlHash: string };
}
export interface Pending {
  source: "ghost" | "contextflow";
  recommendation: Recommendation;
  expiresAt: number;
}
export interface SessionState {
  version: 2;
  accountPreferences?: AccountPreferences;
  assistant?: AssistantGrant;
  companion?: AssistantGrant;
  companionAllowSwitch?:boolean;
  tabs: Record<string, AuthorizedTab>;
  remoteAIAllowed?: boolean;
  backendAllowed: boolean;
  openTabsAllowed: boolean;
  ghost: {
    mode: "disabled" | "enabled" | "paused";
    patterns: Pattern[];
    dismissed: string[];
    lastSignature: string;
    lastObservedAt: number;
  };
  pending: Pending[];
}
export function emptySession(): SessionState {
  return { version: 2, tabs: {}, backendAllowed: false, openTabsAllowed: false,
    ghost: { mode: "disabled", patterns: [], dismissed: [], lastSignature: "", lastObservedAt: 0 }, pending: [] };
}
export function pruneSession(state: SessionState, now: number): SessionState {
  for (const [id, tab] of Object.entries(state.tabs)) if (tab.expiresAt <= now) delete state.tabs[id];
  state.ghost.patterns = state.ghost.patterns.filter(p => now - p.lastSeenAt < SESSION_TTL);
  state.pending = state.pending.filter(p => p.expiresAt > now);
  return state;
}
export interface SessionStore {
  load(): Promise<SessionState>;
  save(state: SessionState): Promise<void>;
}
export const chromeSessionStore: SessionStore = {
  async load() {
    const data = await chrome.storage.session.get("naviSession");
    return isRecord(data.naviSession) && data.naviSession.version === 2 ? data.naviSession as unknown as SessionState : emptySession();
  },
  async save(state) { await chrome.storage.session.set({ naviSession: state }); },
};
