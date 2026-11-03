import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
export async function serverSupabase() {
  const config = supabaseConfig(); if (!config) throw new Error("Supabase is not configured");
  const jar = await cookies();
  return createServerClient(config.url, config.key, { cookieOptions:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}, cookies: {
    getAll: () => jar.getAll(),
    setAll(values) { try { for (const { name, value, options } of values) jar.set(name,value,options); } catch { /* Server component: proxy refreshes cookies. */ } },
  } });
}
