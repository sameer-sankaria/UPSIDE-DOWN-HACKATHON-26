import { AssistantEngine } from "./assistant-engine";
import { parseBridgeCommand } from "@navi-os/shared";
import { handleExternalMessage } from "./messaging/external";
import { isPopupSender, parseCommand } from "./messaging/internal";
import { ContextController } from "./controller";
import { chromeSessionStore } from "./session/state";

const controller = new ContextController(chromeSessionStore);
const assistant = new AssistantEngine(chromeSessionStore, controller);
// Serialize state transitions to prevent concurrent storage writes and approval replays.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work); queue = next.catch(() => undefined); return next;
}
chrome.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
  // Phase 1 pings keep their exact strict contract. Assistant messages use a separate paired capability.
  try {
    const command = parseBridgeCommand(message);
    const work = async () => assistant.handle(command, sender);
    if (command.type === "NAVI_ASSISTANT_CANCEL") {
      void assistant.interrupt(command, sender).then(() => enqueue(work)).then(data => sendResponse({ ok: true, data }), () => sendResponse({ ok: false, error: "Cancellation unavailable" }));
    } else {
      void enqueue(work).then(data => sendResponse({ ok: true, data }), (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Assistant request failed" }));
    }
    return true;
  } catch { sendResponse(handleExternalMessage(message, sender)); return false; }
});
chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (!isPopupSender(sender)) { sendResponse({ ok: false, error: "Forbidden sender" }); return false; }
  try {
    const command = parseCommand(message);
    if (["GHOST_CONTROL", "CLEAR_SESSION", "REVOKE_TAB", "REVOKE_CONTENT", "ASSISTANT_REVOKE", "SET_AI_CONSENT"].includes(command.type)) controller.cancelPendingRequests();
    if (["ASSISTANT_REVOKE", "ASSISTANT_PAIR", "CLEAR_SESSION", "REVOKE_TAB", "REVOKE_CONTENT", "SET_OPEN_PERMISSION", "SET_AI_CONSENT", "AUTHORIZE_METADATA", "AUTHORIZE_CONTENT"].includes(command.type)) assistant.stop();
    void enqueue(() => controller.dispatch(command)).then(
      data => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Command failed" }),
    );
    return true;
  } catch { sendResponse({ ok: false, error: "Invalid command" }); return false; }
});
chrome.tabs.onUpdated.addListener((id, change, tab) => {
  if (change.url !== undefined || change.status === "loading") void chromeSessionStore.load().then(state => { if (state.tabs[id]) assistant.stop(); }).catch(() => undefined);
  void enqueue(() => controller.updated(id, change, tab)).catch(() => undefined); });
chrome.tabs.onActivated.addListener(info => { void enqueue(() => controller.activated(info.tabId)).catch(() => undefined); });
chrome.tabs.onRemoved.addListener(id => { void chromeSessionStore.load().then(state => { if (state.tabs[id]) assistant.stop(); }).catch(() => undefined); void enqueue(() => controller.removed(id)).catch(() => undefined); });
