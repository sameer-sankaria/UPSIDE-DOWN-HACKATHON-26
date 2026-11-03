import { isAllowedWebUrl, isPingMessage, WEB_ORIGIN, type PongMessage, type ProtocolError } from "@navi-os/shared";
export interface ExternalSender {
  id?: string;
  url?: string;
  origin?: string;
  frameId?: number;
  tab?: { id?: number };
}
export function handleExternalMessage(message: unknown, sender: ExternalSender): PongMessage | ProtocolError {
  // Reject extensions, iframes, opaque origins, other localhost ports, and non-tab senders.
  if (sender.id !== undefined || sender.tab?.id === undefined || sender.frameId !== 0
      || sender.origin !== WEB_ORIGIN || !isAllowedWebUrl(sender.url)) {
    return { version: 1, type: "NAVI_ERROR", code: "FORBIDDEN" };
  }
  if (!isPingMessage(message)) return { version: 1, type: "NAVI_ERROR", code: "INVALID_MESSAGE" };
  return { version: 1, type: "NAVI_PONG", requestId: message.requestId, app: "NAVI OS" };
}
