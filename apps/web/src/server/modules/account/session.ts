import { redirect } from "next/navigation";
import { serverSupabase } from "../../../lib/supabase/server";
import { supabaseConfig } from "../../../lib/supabase/config";
import { validAccount, safeNext } from "./security";
export async function accountSession() {
  if (!supabaseConfig()) return null;
  try {
    const db = await serverSupabase(); const {data,error} = await db.auth.getUser();
    if (error || !validAccount(data.user)) return null;
    return { db, user:data.user! };
  } catch { return null; }
}
export async function requireAccount(next="/dashboard") {
  const session = await accountSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return session;
}
