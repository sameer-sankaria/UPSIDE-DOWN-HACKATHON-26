import { serviceSupabase } from "../../../lib/supabase/service";
export type UsageEvent = "user_login"|"extension_connected"|"ai_request_completed"|"contextflow_suggestion_accepted"|"browser_action_completed";
/** Call only at server-observed milestones; no generic public event-ingestion endpoint. */
export async function recordUsage(userId:string,event:UsageEvent) {
  try { await serviceSupabase().rpc("navi_record_usage",{p_user_id:userId,p_event_type:event}); } catch { /* Optional analytics never blocks product use. */ }
}
