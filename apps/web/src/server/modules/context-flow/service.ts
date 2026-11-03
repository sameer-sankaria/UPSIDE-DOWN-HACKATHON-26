import { recommendContext, sanitizeText, type ContextRequest } from "@navi-os/shared";
export function contextFlow(request: ContextRequest) {
  return recommendContext(request.tabs.map(t => ({ ...t, title: sanitizeText(t.title, 200), text: sanitizeText(t.text) })));
}
