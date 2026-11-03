import {safeNavigationUrl} from "./navigation";
import { isRecord } from "./protocol";
import { isSensitiveUrl, safeOrigin, type TabContext } from "./intelligence";
import { ValidationError, type Schema, contextRequestSchema } from "./schemas";

export type AssistantMode = "SHOW_ME" | "DO_IT";
export type PlannedAction =
  | { type: "open_url"; url: string }
  | { type: "search"; query: string }
  | { type: "open_tab"; origin: string }
  | { type: "switch_tab"; tabId: number }
  | { type: "close_tab"; tabId: number }
  | { type: "group_tabs"; tabIds: number[]; title: string };
export interface AssistantPlan { version: 1; summary: string; steps: string[]; actions: PlannedAction[] }
export interface AssistantRequest { version: 1; mode: AssistantMode; instruction: string; tabs: TabContext[] }
export interface AssistantResponse { version: 1; provider: "gemini" | "fallback"; notice: string; plan: AssistantPlan }
export interface ActionResult { index: number; status: "verified" | "failed" | "cancelled"; detail: string }
function ensure(value: unknown): asserts value { if (!value) throw new ValidationError("Invalid assistant schema"); }
function obj(value: unknown, keys: string[]): Record<string, unknown> {
  ensure(isRecord(value) && Object.keys(value).sort().join() === [...keys].sort().join()); return value;
}
function str(value: unknown, max: number): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u0008<>]/.test(value); }
function tab(value: unknown): value is number { return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 2147483647; }
export function parseAction(value: unknown): PlannedAction {
  ensure(isRecord(value));
  switch (value.type) {
    case "open_url": obj(value,["type","url"]); ensure(str(value.url,2000)); try{ensure(safeNavigationUrl(value.url)===value.url);}catch{throw new ValidationError("Safe HTTPS URL required");} break;
    case "search": obj(value, ["type", "query"]); ensure(str(value.query, 200) && !/[\r\n]/.test(value.query)); break;
    case "open_tab": obj(value, ["type", "origin"]); ensure(str(value.origin, 300));
      try { ensure(safeOrigin(value.origin) === value.origin && !isSensitiveUrl(value.origin)); } catch { throw new ValidationError("Safe origin required"); } break;
    case "close_tab": case "switch_tab": obj(value, ["type", "tabId"]); ensure(tab(value.tabId)); break;
    case "group_tabs": obj(value, ["type", "tabIds", "title"]); ensure(Array.isArray(value.tabIds) && value.tabIds.length >= 2 && value.tabIds.length <= 10 && value.tabIds.every(tab) && new Set(value.tabIds).size === value.tabIds.length && str(value.title, 60)); break;
    default: throw new ValidationError("Unsupported browser action");
  }
  return value as PlannedAction;
}
export const assistantPlanSchema: Schema<AssistantPlan> = { parse(value) {
  const p = obj(value, ["version", "summary", "steps", "actions"]);
  ensure(p.version === 1 && str(p.summary, 4000) && Array.isArray(p.steps) && p.steps.length <= 8 && p.steps.every(s => str(s, 500)) && Array.isArray(p.actions) && p.actions.length <= 5);
  p.actions.forEach(parseAction); return value as AssistantPlan;
} };
export const assistantRequestSchema: Schema<AssistantRequest> = { parse(value) {
  const r = obj(value, ["version", "mode", "instruction", "tabs"]);
  ensure(r.version === 1 && ["SHOW_ME", "DO_IT"].includes(r.mode as string) && str(r.instruction, 2000) && Array.isArray(r.tabs) && r.tabs.length <= 10);
  const ids = new Set<number>(); let contentCount = 0;
  for (const t of r.tabs) {
    contextRequestSchema.parse({ version: 1, tabs: [t] });
    ensure(!ids.has(t.tabId)); ids.add(t.tabId); if (t.text) contentCount++;
  }
  ensure(contentCount <= 2); return value as AssistantRequest;
} };
export const assistantResponseSchema: Schema<AssistantResponse> = { parse(value) {
  const r = obj(value, ["version", "provider", "notice", "plan"]);
  ensure(r.version === 1 && ["gemini", "fallback"].includes(r.provider as string) && typeof r.notice === "string" && r.notice.length <= 500);
  assistantPlanSchema.parse(r.plan); return value as AssistantResponse;
} };
export function validatePlanContext(plan: AssistantPlan, tabs: Pick<TabContext, "tabId" | "url">[]) {
  const ids = new Set(tabs.map(t => t.tabId)); const origins = new Set(tabs.map(t => t.url));
  for (const action of plan.actions) {
    if(action.type==="open_url" || action.type==="close_tab")ensure(false);
    if (action.type === "switch_tab") ensure(ids.has(action.tabId));
    if (action.type === "group_tabs") ensure(action.tabIds.every(id => ids.has(id)));
    if (action.type === "open_tab") ensure(origins.has(action.origin));
  }
}
export const PLAN_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["version", "summary", "steps", "actions"],
  properties: {
    version: { type: "integer", enum: [1] }, summary: { type: "string", maxLength: 4000 },
    steps: { type: "array", maxItems: 8, items: { type: "string", maxLength: 500 } },
    actions: { type: "array", maxItems: 5, items: { anyOf: [
      {type:"object",additionalProperties:false,required:["type","url"],properties:{type:{type:"string",enum:["open_url"]},url:{type:"string",maxLength:2000}}},
      { type: "object", additionalProperties: false, required: ["type", "query"], properties: { type: { type: "string", enum: ["search"] }, query: { type: "string", maxLength: 200 } } },
      { type: "object", additionalProperties: false, required: ["type", "origin"], properties: { type: { type: "string", enum: ["open_tab"] }, origin: { type: "string", maxLength: 300 } } },
      { type: "object", additionalProperties: false, required: ["type", "tabId"], properties: { type: { type: "string", enum: ["switch_tab"] }, tabId: { type: "integer", minimum: 0 } } },
      { type: "object", additionalProperties: false, required: ["type", "tabId"], properties: { type: { type: "string", enum: ["close_tab"] }, tabId: { type: "integer", minimum: 0 } } },
      { type: "object", additionalProperties: false, required: ["type", "tabIds", "title"], properties: { type: { type: "string", enum: ["group_tabs"] }, tabIds: { type: "array", minItems: 2, maxItems: 10, items: { type: "integer", minimum: 0 } }, title: { type: "string", maxLength: 60 } } },
    ] } },
  },
} as const;

export interface AssistantGrant {
  accountUserId?:string;
  approvedUrls?:string[];
  allowClose?: boolean;
  token: string; expiresAt: number; dashboardTabId?: number; allowManage: boolean;
  pending?: { id: string; mode: "DO_IT"; actions: PlannedAction[]; snapshots: Record<string, string>; expiresAt: number };
  capture?: { id: string; snapshots: Record<string, string>; expiresAt: number };
  results: ActionResult[];
}
export type AssistantBridgeCommand =
  | { type: "NAVI_ASSISTANT_VALIDATE"; token: string; contextId: string }
  | { type: "NAVI_ASSISTANT_CONTEXT"; token: string; contentTabIds: number[] }
  | { type: "NAVI_ASSISTANT_STAGE"; token: string; contextId: string; mode: AssistantMode; plan: AssistantPlan }
  | { type: "NAVI_ASSISTANT_EXECUTE"; token: string; planId: string; indices: number[]; approved: true }
  | { type: "NAVI_ASSISTANT_CANCEL"; token: string }
  | { type: "NAVI_ASSISTANT_STATUS"; token: string };
export function parseBridgeCommand(value: unknown): AssistantBridgeCommand {
  ensure(isRecord(value) && typeof value.token === "string" && /^[a-f0-9]{64}$/.test(value.token));
  switch (value.type) {
    case "NAVI_ASSISTANT_VALIDATE": obj(value, ["type", "token", "contextId"]); ensure(typeof value.contextId === "string" && /^[a-z0-9-]{1,80}$/.test(value.contextId)); break;
    case "NAVI_ASSISTANT_CONTEXT": obj(value, ["type", "token", "contentTabIds"]); ensure(Array.isArray(value.contentTabIds) && value.contentTabIds.length <= 2 && value.contentTabIds.every(tab) && new Set(value.contentTabIds).size === value.contentTabIds.length); break;
    case "NAVI_ASSISTANT_STAGE": obj(value, ["type", "token", "contextId", "mode", "plan"]); ensure(value.mode === "DO_IT" && typeof value.contextId === "string" && /^[a-z0-9-]{1,80}$/.test(value.contextId)); assistantPlanSchema.parse(value.plan); break;
    case "NAVI_ASSISTANT_EXECUTE": obj(value, ["type", "token", "planId", "indices", "approved"]); ensure(typeof value.planId === "string" && /^[a-z0-9-]{1,80}$/.test(value.planId) && value.approved === true && Array.isArray(value.indices) && value.indices.length > 0 && value.indices.length <= 5 && value.indices.every(i => Number.isInteger(i) && i >= 0 && i < 5) && new Set(value.indices).size === value.indices.length); break;
    case "NAVI_ASSISTANT_CANCEL": case "NAVI_ASSISTANT_STATUS": obj(value, ["type", "token"]); break;
    default: throw new ValidationError("Unsupported assistant command");
  }
  return value as AssistantBridgeCommand;
}
