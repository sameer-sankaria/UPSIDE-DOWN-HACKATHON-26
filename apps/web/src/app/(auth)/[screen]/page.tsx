import {notFound} from "next/navigation";
import {AuthForm} from "../../../components/auth-form";
import {safeNext,SCREENS} from "../../../server/modules/account/security";
import {supabaseConfig} from "../../../lib/supabase/config";
export default async function AuthPage({params,searchParams}:{params:Promise<{screen:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {screen}=await params; if (!(SCREENS as readonly string[]).includes(screen)) notFound();
  const query=await searchParams;
  const titles:Record<string,string>={login:"Welcome back.",signup:"Make it yours.","forgot-password":"Find your way back.","reset-password":"A fresh start.","verify-email":"Check your inbox."};
  return <main className="account-shell"><a className="dashboard-brand" href="/">NAVI OS<span> ●</span></a><section className="account-card"><span className="navi-eyebrow">YOUR BROWSER. YOUR AI. YOUR CONTROL.</span><h1>{titles[screen]}</h1><p>{screen==="verify-email"?"Confirm your email before signing in. Links expire; request a fresh one below.":"One account for your workspace, preferences, and approved browser assistance."}</p>
    {!supabaseConfig()&&<p role="status" className="account-error">Account setup is incomplete. Configure the Supabase URL and publishable key to enable authentication.</p>}
    {query.error&&<p role="alert" className="account-error">The authentication link was invalid, expired, or could not be verified. Request a fresh email.</p>}
    {query.logged_out&&<p role="status">You have been logged out and extension sessions revoked.</p>}
    <AuthForm screen={screen} next={safeNext(query.next)}/>
    <nav className="account-links" aria-label="Account"><a href={`/login?next=${encodeURIComponent(safeNext(query.next))}`}>Login</a><a href={`/signup?next=${encodeURIComponent(safeNext(query.next))}`}>Create account</a><a href="/forgot-password">Forgot password?</a><a href="/verify-email">Confirm email</a><a href="/dashboard">Dashboard ↗</a></nav>
  </section></main>;
}
