import { isAllowedWebUrl, isPongMessage, type PingMessage, type PongMessage } from "@navi-os/shared";

type Runtime = {
  sendMessage(id: string, message: PingMessage, callback: (response: unknown) => void): void;
  lastError?: { message?: string };
};

/** A ping-only client. Does not send tab data or expose browser actions. */
export async function pingExtension(extensionId: string): Promise<PongMessage> {
  if (!isAllowedWebUrl(window.location.href)) throw new Error("Use http://localhost:3000.");
  if (!/^[a-p]{32}$/.test(extensionId)) throw new Error("Invalid Chrome extension ID.");
  const runtime = (window as Window & { chrome?: { runtime?: Runtime } }).chrome?.runtime;
  if (!runtime?.sendMessage) throw new Error("Load the extension in Chrome, then reload this page.");
  const message: PingMessage = { version: 1, type: "NAVI_PING", requestId: crypto.randomUUID() };
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Extension ping timed out.")), 5000);
    try {
      runtime.sendMessage(extensionId, message, response => {
        clearTimeout(timeout);
        const error = runtime.lastError;
        if (error) return reject(new Error(error.message ?? "Extension unavailable."));
        if (!isPongMessage(response) || response.requestId !== message.requestId) {
          return reject(new Error("Invalid extension response."));
        }
        resolve(response);
      });
    } catch (error) { clearTimeout(timeout); reject(error); }
  });
}
