import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
/** Imported only by server modules. Never pass this client or key to a component. */
export function serviceSupabase() {
  if (typeof window !== "undefined") throw new Error("Server only");
  const config = supabaseConfig(); const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !secret) throw new Error("Server account services are not configured");
  return createClient(config.url,secret,{ auth: { persistSession:false,autoRefreshToken:false,detectSessionInUrl:false } });
}
