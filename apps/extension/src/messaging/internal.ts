import { isRecord } from "@navi-os/shared";
export type InternalCommand =
  | { type: "ACCOUNT_SIGN_IN"|"ACCOUNT_SYNC"|"ACCOUNT_SIGN_OUT" }
  | { type: "ASSISTANT_PAIR"; allowManage: boolean }
  | { type: "ASSISTANT_REVOKE" }
  | { type: "STATE" | "AUTHORIZE_METADATA" | "AUTHORIZE_CONTENT" | "CONNECT_BACKEND" | "GHOST_SUGGEST" | "CLEAR_SESSION" }
  | { type: "REVOKE_TAB" | "REVOKE_CONTENT"; tabId: number }
  | { type: "GHOST_CONTROL"; action: "enable" | "pause" | "disable" | "clear" }
  | { type: "SET_OPEN_PERMISSION" | "SET_AI_CONSENT"; enabled: boolean }
  | { type: "ANALYZE"; tabIds: number[] }
  | { type: "DISMISS"; id: string }
  | { type: "OPEN_SELECTED"; id: string; indices: number[]; approved: true };
export function parseCommand(value: unknown): InternalCommand {
  if (!isRecord(value) || typeof value.type !== "string") throw new Error("Invalid command");
  const keys = Object.keys(value).sort().join(",");
  const id = (v: unknown) => typeof v === "string" && /^[a-z0-9-]{1,80}$/.test(v);
  const tab = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
  const list = (v: unknown, max: number) => Array.isArray(v) && v.length > 0 && v.length <= max && new Set(v).size === v.length && v.every(tab);
  switch (value.type) {
    case "ACCOUNT_SIGN_IN": case "ACCOUNT_SYNC": case "ACCOUNT_SIGN_OUT": if(keys === "type")return value as InternalCommand; break;
    case "ASSISTANT_PAIR": if (keys === "allowManage,type" && typeof value.allowManage === "boolean") return value as InternalCommand; break;
    case "ASSISTANT_REVOKE": if (keys === "type") return value as InternalCommand; break;
    case "STATE": case "AUTHORIZE_METADATA": case "AUTHORIZE_CONTENT": case "CONNECT_BACKEND": case "GHOST_SUGGEST": case "CLEAR_SESSION":
      if (keys === "type") return value as InternalCommand; break;
    case "REVOKE_TAB": case "REVOKE_CONTENT": if (keys === "tabId,type" && tab(value.tabId)) return value as InternalCommand; break;
    case "GHOST_CONTROL": if (keys === "action,type" && ["enable", "pause", "disable", "clear"].includes(value.action as string)) return value as InternalCommand; break;
    case "SET_AI_CONSENT": case "SET_OPEN_PERMISSION": if (keys === "enabled,type" && typeof value.enabled === "boolean") return value as InternalCommand; break;
    case "ANALYZE": if (keys === "tabIds,type" && list(value.tabIds, 2)) return value as InternalCommand; break;
    case "DISMISS": if (keys === "id,type" && id(value.id)) return value as InternalCommand; break;
    case "OPEN_SELECTED": if (keys === "approved,id,indices,type" && id(value.id) && list(value.indices, 3) && value.approved === true) return value as InternalCommand; break;
  }
  throw new Error("Invalid command");
}
export function isPopupSender(sender: chrome.runtime.MessageSender): boolean {
  return sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL("popup.html") && !sender.tab;
}
