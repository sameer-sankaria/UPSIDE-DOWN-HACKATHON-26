export const PROTOCOL_VERSION = 1 as const;
export const WEB_ORIGIN = "http://localhost:3000";

export interface PingMessage {
  version: 1;
  type: "NAVI_PING";
  requestId: string;
}
export interface PongMessage {
  version: 1;
  type: "NAVI_PONG";
  requestId: string;
  app: "NAVI OS";
}
export interface ProtocolError {
  version: 1;
  type: "NAVI_ERROR";
  code: "FORBIDDEN" | "INVALID_MESSAGE";
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function validRequestId(id: unknown): id is string {
  return typeof id === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(id);
}
export function isPingMessage(value: unknown): value is PingMessage {
  return isRecord(value) && hasKeys(value, ["version", "type", "requestId"])
    && value.version === 1 && value.type === "NAVI_PING" && validRequestId(value.requestId);
}
export function isPongMessage(value: unknown): value is PongMessage {
  return isRecord(value) && hasKeys(value, ["version", "type", "requestId", "app"])
    && value.version === 1 && value.type === "NAVI_PONG" && value.app === "NAVI OS"
    && validRequestId(value.requestId);
}
export function isAllowedWebUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.origin === WEB_ORIGIN && !url.username && !url.password;
  } catch { return false; }
}
