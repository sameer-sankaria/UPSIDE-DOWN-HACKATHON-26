import { handleExternalMessage } from "./messaging/external";
import { isPopupSender, parseCommand } from "./messaging/internal";
import { ContextController } from "./controller";
import { chromeSessionStore } from "./session/state";

const controller = new ContextController(chromeSessionStore);
// Serialize state transitions to prevent concurrent storage writes and approval replays.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work); queue = next.catch(() => undefined); return next;
}
chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  // The website remains ping-only: no external content, permissions, or browser commands.
  sendResponse(handleExternalMessage(message, sender)); return false;
});
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isPopupSender(sender)) { sendResponse({ ok: false, error: "Forbidden sender" }); return false; }
  try {
    const command = parseCommand(message);
    void enqueue(() => controller.dispatch(command)).then(
      data => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Command failed" }),
    );
    return true;
  } catch { sendResponse({ ok: false, error: "Invalid command" }); return false; }
});
chrome.tabs.onUpdated.addListener((id, change, tab) => { void enqueue(() => controller.updated(id, change, tab)).catch(() => undefined); });
chrome.tabs.onActivated.addListener(info => { void enqueue(() => controller.activated(info.tabId)).catch(() => undefined); });
chrome.tabs.onRemoved.addListener(id => { void enqueue(() => controller.removed(id)).catch(() => undefined); });
