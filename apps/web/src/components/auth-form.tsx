"use client";
import {useActionState} from "react";
import {authAction,type AuthState} from "../app/auth/actions";
export function AuthForm({screen,next}:{screen:string;next:string}) {
  const [state,action,pending]=useActionState<AuthState,FormData>(authAction,{});
  const reset=screen==="reset-password",forgot=screen==="forgot-password",verify=screen==="verify-email",signup=screen==="signup";
  return <form action={action} className="account-form">
    <input type="hidden" name="screen" value={verify?"resend":screen}/><input type="hidden" name="next" value={next}/>
    {signup&&<label>Your name<input name="name" required maxLength={100} autoComplete="name"/></label>}
    {!reset&&<label>Email<input name="email" type="email" required maxLength={254} autoComplete="email"/></label>}
    {!forgot&&!verify&&<label>{reset?"New password":"Password"}<input name="password" type="password" required minLength={8} maxLength={128} autoComplete={signup||reset?"new-password":"current-password"}/></label>}
    {state.error&&<p role="alert" className="account-error">{state.error}</p>}{state.message&&<p role="status" className="account-success">{state.message}</p>}
    <button disabled={pending} type="submit">{pending?"Please wait…":signup?"Create account":forgot?"Send reset email":reset?"Update password":verify?"Resend confirmation":"Log in"}</button>
    <p className="account-note">{signup?"Email confirmation is required. Anonymous accounts are not available.":"Your password is handled by Supabase Auth and is never included in analytics."}</p>
  </form>;
}
