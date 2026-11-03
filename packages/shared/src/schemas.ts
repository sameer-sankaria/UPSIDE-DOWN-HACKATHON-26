import { isRecord } from "./protocol";
import { SITES, TOPICS, safeOrigin, type Analysis, type ContextRequest, type GhostRequest, type Recommendations } from "./intelligence";
export interface Schema<T> { parse(value: unknown): T }
export class ValidationError extends Error {}
function check(condition: unknown): asserts condition {
  if (!condition) throw new ValidationError("Invalid request or response schema");
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  check(isRecord(value) && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)));
  return value;
}
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }
function number(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
function list(value: unknown, allowed: readonly string[], max: number): boolean {
  return Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(v => typeof v === "string" && allowed.includes(v));
}
export const contextRequestSchema: Schema<ContextRequest> = { parse(value) {
  const o = object(value, ["version", "tabs"]);
  check(o.version === 1 && Array.isArray(o.tabs) && o.tabs.length >= 1 && o.tabs.length <= 2);
  const ids = new Set<number>();
  for (const entry of o.tabs) {
    const t = object(entry, ["tabId", "title", "url", "text", "capturedAt"]);
    check(Number.isInteger(t.tabId) && number(t.tabId, 0, 2147483647) && !ids.has(t.tabId));
    ids.add(t.tabId);
    check(text(t.title, 200) && text(t.text, 8000) && text(t.url, 300));
    try { check(safeOrigin(t.url) === t.url); } catch { throw new ValidationError("Origin-only URL required"); }
    check(number(t.capturedAt, 0, Number.MAX_SAFE_INTEGER));
  }
  return value as ContextRequest;
} };
export const ghostRequestSchema: Schema<GhostRequest> = { parse(value) {
  const o = object(value, ["version", "patterns"]);
  check(o.version === 1 && Array.isArray(o.patterns) && o.patterns.length <= 16);
  for (const entry of o.patterns) {
    const p = object(entry, ["sites", "topics", "count", "lastSeenAt"]);
    check(list(p.sites, SITES, 4) && list(p.topics, TOPICS, 5));
    check(Number.isInteger(p.count) && number(p.count, 1, 100) && number(p.lastSeenAt, 0, Number.MAX_SAFE_INTEGER));
  }
  return value as GhostRequest;
} };
export const analysisSchema: Schema<Analysis> = { parse(value) {
  const o = object(value, ["version", "topics", "sites"]);
  check(o.version === 1 && list(o.topics, TOPICS, 5) && list(o.sites, SITES, 4));
  return value as Analysis;
} };
export const recommendationsSchema: Schema<Recommendations> = { parse(value) {
  const o = object(value, ["version", "recommendations"]);
  check(o.version === 1 && Array.isArray(o.recommendations) && o.recommendations.length <= 5);
  const ids = new Set<string>();
  for (const entry of o.recommendations) {
    const s = object(entry, ["id", "kind", "title", "reason", "confidence", "topics", "queries", "requiresApproval"]);
    check(typeof s.id === "string" && /^[a-z0-9-]{1,80}$/.test(s.id) && !ids.has(s.id)); ids.add(s.id);
    check(["workspace", "search"].includes(s.kind as string) && text(s.title, 200) && text(s.reason, 500));
    check(number(s.confidence, 0, 1) && list(s.topics, TOPICS, 5) && s.requiresApproval === true);
    check(Array.isArray(s.queries) && s.queries.length >= 1 && s.queries.length <= 3
      && s.queries.every(q => text(q, 200) && q.length > 0 && !/[\r\n<>]/.test(q)));
  }
  return value as Recommendations;
} };
