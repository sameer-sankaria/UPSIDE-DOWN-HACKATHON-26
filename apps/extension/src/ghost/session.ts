import { analyzeContext, suggestGhost } from "@navi-os/shared";
import { SESSION_TTL, type SessionState } from "../session/state";
export function observeSession(state: SessionState, now: number): void {
  if (state.ghost.mode !== "enabled") return;
  const tabs = Object.values(state.tabs).filter(t => t.expiresAt > now);
  if (!tabs.length) return;
  const analysis = analyzeContext(tabs.map(t => ({ tabId: t.id, title: t.title, url: t.url, text: "", capturedAt: now })));
  const sites = [...analysis.sites].sort(); const topics = [...analysis.topics].sort();
  const signature = JSON.stringify([sites, topics]);
  if (signature === state.ghost.lastSignature && now - state.ghost.lastObservedAt < 30000) return;
  state.ghost.lastSignature = signature; state.ghost.lastObservedAt = now;
  state.ghost.patterns = state.ghost.patterns.filter(p => now - p.lastSeenAt < SESSION_TTL);
  const previous = state.ghost.patterns.find(p => JSON.stringify([p.sites, p.topics]) === signature);
  if (previous) { previous.count = Math.min(100, previous.count + 1); previous.lastSeenAt = now; }
  else state.ghost.patterns.push({ sites, topics, count: 1, lastSeenAt: now });
  state.ghost.patterns = state.ghost.patterns.slice(-16);
}
export function localGhostSuggestions(state: SessionState) {
  if (state.ghost.mode !== "enabled") return [];
  return suggestGhost({ version: 1, patterns: state.ghost.patterns }).recommendations
    .filter(s => !state.ghost.dismissed.includes(s.id));
}
