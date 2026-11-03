export const SCREENS = ["login","signup","forgot-password","reset-password","verify-email"] as const;
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/dashboard";
  try { const parsed = new URL(value,"http://localhost:3000"); return parsed.origin === "http://localhost:3000" && !["/login","/signup"].includes(parsed.pathname) ? parsed.pathname + parsed.search : "/dashboard"; } catch { return "/dashboard"; }
}
export function authOrigin() { return "http://localhost:3000"; } // Existing extension and API allowlist boundary.
export function validAccount(user: { id: string; email_confirmed_at?: string; is_anonymous?: boolean } | null | undefined) { return !!user?.id && !!user.email_confirmed_at && !user.is_anonymous; }
export interface Preferences { ghost_mode_enabled:boolean; contextflow_enabled:boolean; preferred_ai_mode:"SHOW_ME"|"DO_IT"; analytics_enabled:boolean }
export function parsePreferences(value: unknown): Preferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid preferences");
  const o = value as Record<string,unknown>;
  if (Object.keys(o).sort().join()!==["analytics_enabled","contextflow_enabled","ghost_mode_enabled","preferred_ai_mode"].join() || typeof o.ghost_mode_enabled!=="boolean" || typeof o.contextflow_enabled!=="boolean" || typeof o.analytics_enabled!=="boolean" || !["SHOW_ME","DO_IT"].includes(o.preferred_ai_mode as string)) throw new Error("Invalid preferences");
  return o as unknown as Preferences;
}
export function validExtensionFlow(id: unknown, challenge: unknown, state: unknown) {
  return typeof id === "string" && /^[a-p]{32}$/.test(id) && id === process.env.NAVI_EXTENSION_ID && typeof challenge === "string" && /^[a-f0-9]{64}$/.test(challenge) && typeof state === "string" && /^[a-f0-9]{64}$/.test(state);
}
