export interface BrowserTab {
  id: number;
  title: string;
  url: string;
  windowId: number;
}

/** Planning contracts only; no browser action executor exists in Phase 1. */
export interface BrowserAction {
  id: string;
  taskId: string;
  tabId: number;
  type: "navigate" | "click" | "type" | "scroll";
  parameters: Record<string, unknown>;
  requiredScopes: PermissionScope["name"][];
}

export interface AgentTask {
  id: string;
  instruction: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  createdAt: string;
  actions: BrowserAction[];
}

export interface PermissionScope {
  name: "tab:metadata" | "page:read" | "session:monitor" | "tabs:open" | "browser:interact";
  granted: boolean;
  tabId?: number;
  origin?: string;
  expiresAt?: string;
}

export interface ContextSuggestion {
  id: string;
  taskId?: string;
  title: string;
  reason: string;
  createdAt: string;
}
