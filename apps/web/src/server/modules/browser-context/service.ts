import { analyzeContext, sanitizeText, type ContextRequest } from "@navi-os/shared";
export function analyzeBrowserContext(request: ContextRequest) {
  return analyzeContext(request.tabs.map(t => ({ ...t, title: sanitizeText(t.title, 200), text: sanitizeText(t.text) })));
}
