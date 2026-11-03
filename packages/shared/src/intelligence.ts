export const TOPICS = ["react", "typescript", "nextjs", "javascript", "development"] as const;
export type Topic = typeof TOPICS[number];
export const SITES = ["github", "documentation", "stackoverflow", "other"] as const;
export type Site = typeof SITES[number];
export interface TabContext {
  tabId: number;
  title: string;
  /** Query, fragment, credentials, and path omitted to minimize identifying data. */
  url: string;
  text: string;
  capturedAt: number;
}
export interface ContextRequest { version: 1; tabs: TabContext[] }
export interface Analysis { version: 1; topics: Topic[]; sites: Site[] }
export interface Pattern {
  sites: Site[];
  topics: Topic[];
  count: number;
  lastSeenAt: number;
}
export interface GhostRequest { version: 1; patterns: Pattern[] }
export interface Recommendation {
  id: string;
  kind: "workspace" | "search";
  title: string;
  reason: string;
  confidence: number;
  topics: Topic[];
  queries: string[];
  requiresApproval: true;
}
export interface Recommendations { version: 1; recommendations: Recommendation[] }

/** Conservative defense in depth; cannot identify every kind of personal information. */
export function sanitizeText(value: string, max = 8000): string {
  return value.slice(0, 32000)
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[link]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:password|passcode|otp|token|secret|api[ _-]?key|authorization|verification code)\s*[:=]?\s*\S+/gi, "[sensitive]")
    .replace(/\beyJ[A-Za-z0-9_.-]+/g, "[token]")
    .replace(/\b(?:sk-|ghp_|github_pat_)[A-Za-z0-9_-]+/g, "[token]")
    .replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, "[identifier]")
    .replace(/(?:\+?\d[\d ()-]{4,}\d)/g, "[number]")
    .replace(/\s+/g, " ").trim().slice(0, max);
}
export function safeOrigin(value: string): string {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Unsupported URL");
  return url.origin;
}
export function isSensitiveUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return !["http:", "https:"].includes(u.protocol) || !!u.username || !!u.password
      || /(^|\.)(mail|accounts|banking|webmail)\./i.test(u.hostname)
      || /\/(login|signin|sign-in|auth|oauth|account|checkout|payment|inbox|messages|password|verify)(\/|$)/i.test(u.pathname);
  } catch { return true; }
}
