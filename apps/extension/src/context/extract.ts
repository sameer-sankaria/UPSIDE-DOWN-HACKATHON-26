/** Serialized by chrome.scripting: keep self-contained, isolated-world, main frame only. */
export function extractVisibleText(expectedUrl: string): { text: string; blocked: boolean } {
  if (location.href !== expectedUrl) return { text: "", blocked: true };
  // Do not extract from a page displaying a credential or verification-code entry control.
  if (document.querySelector('input[type="password"],input[autocomplete="one-time-code"],input[name*="otp" i],input[name*="password" i]')) {
    return { text: "", blocked: true };
  }
  const root = document.querySelector("main,article,[role=main]") ?? document.body;
  if (!root) return { text: "", blocked: false };
  const exclude = 'form,input,textarea,select,option,button,label,script,style,noscript,iframe,canvas,svg,nav,footer,header,dialog,[role="dialog"],[role="textbox"],[role="searchbox"],[role="combobox"],[contenteditable]:not([contenteditable="false"]),[hidden],[aria-hidden="true"],[inert],[data-private],[data-sensitive],[autocomplete],[class*="private" i],[class*="secret" i],[class*="password" i],[class*="otp" i],[id*="private" i],[id*="secret" i],[id*="password" i],[id*="otp" i]';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts: string[] = []; let length = 0; let visited = 0;
  while (walker.nextNode() && length < 8000 && ++visited <= 20000) {
    const node = walker.currentNode;
    const parent = node.parentElement;
    if (!parent || parent.closest(exclude)) continue;
    let visible = true;
    for (let el: Element | null = parent; el; el = el.parentElement) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0) { visible = false; break; }
    }
    if (!visible) continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    if (!rects.some(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth)) continue;
    const raw = node.textContent ?? "";
    // Skip whole suspicious text nodes, then redact identifiers/numbers defensively.
    if (/password|passcode|otp|one.time.code|verification.code|api.key|secret|bearer|authorization/i.test(raw)) continue;
    const clean = raw.replace(/(?:https?:\/\/|www\.)\S+/gi, "[link]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/\b(?:sk-|ghp_|github_pat_|eyJ)[A-Za-z0-9_.-]+/g, "[token]")
      .replace(/\b[A-Za-z0-9_+/=-]{32,}\b/g, "[identifier]")
      .replace(/(?:\+?\d[\d ()-]{4,}\d)/g, "[number]")
      .replace(/\s+/g, " ").trim();
    if (clean) { parts.push(clean); length += clean.length + 1; }
  }
  return { text: parts.join(" ").slice(0, 8000), blocked: false };
}
