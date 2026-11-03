import {NextResponse} from "next/server";
import {serverSupabase} from "../../../lib/supabase/server";
import {authOrigin,safeNext} from "../../../server/modules/account/security";
export async function GET(request:Request) {
 const url=new URL(request.url);const code=url.searchParams.get("code");
 if(code) {try {const db=await serverSupabase();const {error}=await db.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")),authOrigin()));}catch{}}
 return NextResponse.redirect(new URL("/login?error=callback",authOrigin()));
}
