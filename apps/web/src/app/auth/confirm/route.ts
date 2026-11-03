import {NextResponse} from "next/server";
import {serverSupabase} from "../../../lib/supabase/server";
import {authOrigin,safeNext} from "../../../server/modules/account/security";
export async function GET(request:Request) {
  const url=new URL(request.url); const token_hash=url.searchParams.get("token_hash"); const type=url.searchParams.get("type");
  if (token_hash&&["signup","recovery","email"].includes(type??"")) {
    try {const db=await serverSupabase(); const {error}=await db.auth.verifyOtp({token_hash,type:type as "signup"|"recovery"|"email"});
      if (!error) return NextResponse.redirect(new URL(type==="recovery"?"/reset-password":safeNext(url.searchParams.get("next")),authOrigin()));
    } catch { /* Expired/unavailable authentication fails closed. */ }
  }
  return NextResponse.redirect(new URL("/login?error=confirmation",authOrigin()));
}
