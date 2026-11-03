import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({request}); const config = supabaseConfig();
  if (!config) return response;
  const db = createServerClient(config.url,config.key,{ cookieOptions:{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"}, cookies: {
    getAll:()=>request.cookies.getAll(),
    setAll(values) {
      for (const {name,value} of values) request.cookies.set(name,value);
      response=NextResponse.next({request});
      for (const {name,value,options} of values) response.cookies.set(name,value,options);
    },
  } });
  try { await db.auth.getUser(); } catch { /* Protected routes independently fail closed. */ }
  response.headers.set("Cache-Control","private, no-store"); return response;
}
export const config={matcher:["/dashboard/:path*","/admin/:path*","/login","/signup","/forgot-password","/reset-password","/verify-email","/auth/:path*","/extension/:path*","/api/:path*"]};
