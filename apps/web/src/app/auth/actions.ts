"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "../../lib/supabase/server";
import { supabaseConfig } from "../../lib/supabase/config";
import { authOrigin, safeNext, validAccount } from "../../server/modules/account/security";
import { recordUsage } from "../../server/modules/account/analytics";
export interface AuthState { error?:string; message?:string }
export async function authAction(_previous:AuthState,form:FormData):Promise<AuthState> {
  if (!supabaseConfig()) return {error:"Account services need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Ask the site operator to finish setup."};
  const screen=String(form.get("screen")); const email=String(form.get("email")??"").trim();
  const password=String(form.get("password")??""); const next=safeNext(form.get("next"));
  if (!["login","signup","forgot-password","reset-password","resend"].includes(screen)) return {error:"Unsupported account action."};
  if (screen!=="reset-password" && (email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return {error:"Enter a valid email address."};
  if (["login","signup","reset-password"].includes(screen) && (password.length<8 || password.length>128)) return {error:"Use a password between 8 and 128 characters."};
  const db=await serverSupabase();
  try {
    if (screen==="signup") {
      const name=String(form.get("name")??"").trim(); if (!name || name.length>100) return {error:"Enter a display name of 1–100 characters."};
      const {error}=await db.auth.signUp({email,password,options:{data:{display_name:name},emailRedirectTo:authOrigin()+"/auth/callback"}});
      if (error) return {error:"Signup could not be completed. Check your details or try again later."};
      return {message:"Check your email to confirm your account before signing in. If you already registered, use Login or resend confirmation."};
    }
    if (screen==="forgot-password") {
      await db.auth.resetPasswordForEmail(email,{redirectTo:authOrigin()+"/auth/callback?next=/reset-password"});
      return {message:"If that account exists, a password reset email has been requested. Check your inbox and spam folder."};
    }
    if (screen==="resend") {
      await db.auth.resend({type:"signup",email,options:{emailRedirectTo:authOrigin()+"/auth/callback"}});
      return {message:"If confirmation is needed, an email has been requested. Please wait before requesting another."};
    }
    if (screen==="reset-password") {
      const {data,error}=await db.auth.getUser(); if (error || !validAccount(data.user)) return {error:"Open a valid password-reset link from your email first."};
      const result=await db.auth.updateUser({password}); if (result.error) return {error:"Password could not be updated. Use a fresh reset link and a different password."};
      const revoked=await db.rpc("navi_revoke_extensions"); if (revoked.error) return {error:"Password updated, but extension sessions could not be revoked. Revoke them from account settings."};
      return {message:"Password updated. Extension sessions were revoked. You can return to the dashboard."};
    }
    const {data,error}=await db.auth.signInWithPassword({email,password});
    if (error || !validAccount(data.user)) {
      if (!error) await db.auth.signOut();
      return {error:"Login failed. Check your email/password and confirm your email first."};
    }
    await db.rpc("navi_touch_activity"); await recordUsage(data.user!.id,"user_login");
  } catch {return {error:"Account service unavailable. Please try again."};}
  redirect(next);
}
export async function logout() {
  const db=await serverSupabase();
  const {error}=await db.rpc("navi_revoke_extensions");
  if (error) redirect("/dashboard?account_error=revocation");
  const result=await db.auth.signOut({scope:"global"});
  if (result.error) redirect("/dashboard?account_error=logout");
  redirect("/login?logged_out=1");
}
