import { sanitizeText, type TabContext, type Topic, type Site, type Analysis, type GhostRequest, type Recommendations, type Recommendation } from "./intelligence";

/** Deterministic provider boundary: a future AI provider must return the same validated contracts. */
export function detectTopics(value: string): Topic[] {
  const s = sanitizeText(value).toLowerCase();
  const result: Topic[] = [];
  if (/\breact\b|react\.dev/.test(s)) result.push("react");
  if (/\btypescript\b|typescriptlang/.test(s)) result.push("typescript");
  if (/\bnext[ .-]?js\b/.test(s)) result.push("nextjs");
  if (/\bjavascript\b/.test(s)) result.push("javascript");
  if (result.length || /\b(developer|development|programming|github|stackoverflow)\b/.test(s)) result.push("development");
  return result;
}
export function classifySite(value: string): Site {
  const host = new URL(value).hostname;
  if (host === "github.com" || host.endsWith(".github.com")) return "github";
  if (host === "stackoverflow.com") return "stackoverflow";
  if (["react.dev", "nextjs.org", "typescriptlang.org", "www.typescriptlang.org", "developer.mozilla.org", "docs.python.org", "nodejs.org"].includes(host) || host.startsWith("docs.")) return "documentation";
  return "other";
}
export function analyzeContext(tabs: TabContext[]): Analysis {
  const sites = [...new Set(tabs.map(t => classifySite(t.url)))];
  const topics = [...new Set(tabs.flatMap(t => detectTopics(`${new URL(t.url).hostname} ${t.title} ${t.text}`)))];
  return { version: 1, sites, topics };
}
function queries(topics: Topic[]): string[] {
  const topic = topics.find(t => t !== "development") ?? "web development";
  return [`${topic} official documentation`, `${topic} GitHub examples`, `${topic} Stack Overflow troubleshooting`];
}
export function recommendContext(tabs: TabContext[]): Recommendations {
  const { topics } = analyzeContext(tabs);
  if (!topics.length) return { version: 1, recommendations: [] };
  return { version: 1, recommendations: [{
    id: `context-${topics[0]}`, kind: "search", title: `Explore ${topics[0]}`,
    reason: "Topic keywords found in the explicitly supplied tab context.", confidence: 0.7,
    topics, queries: queries(topics), requiresApproval: true,
  }] };
}
export function suggestGhost(request: GhostRequest): Recommendations {
  const candidates: Recommendation[] = [];
  for (const p of request.patterns) {
    if (!p.sites.includes("github") || !p.sites.includes("documentation")) continue;
    const topic = p.topics.find(t => t !== "development") ?? "development";
    const id = `workspace-${topic}`;
    if (candidates.some(c => c.id === id)) continue;
    candidates.push({ id, kind: "workspace", title: `Looks like you're working on ${topic}. Prepare your development workspace?`,
      reason: `GitHub + documentation${p.sites.includes("stackoverflow") ? " + Stack Overflow" : ""}; observed ${p.count} time(s) this session.`,
      confidence: Math.min(0.95, 0.65 + Math.min(p.count, 4) * 0.05 + (p.sites.includes("stackoverflow") ? 0.1 : 0)),
      topics: p.topics, queries: queries(p.topics), requiresApproval: true,
    });
  }
  return { version: 1, recommendations: candidates.slice(0, 5) };
}
