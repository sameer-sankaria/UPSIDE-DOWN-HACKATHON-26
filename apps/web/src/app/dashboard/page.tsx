import { requireAccount } from "../../server/modules/account/session";
import { logout } from "../auth/actions";
import { AccountSettings } from "../../components/account-settings";
import { AssistantPanel } from "../../components/assistant-panel";
import type { Metadata } from "next";
import { ConnectionPanel } from "../../components/connection-panel";
import { ExtensionDiagnostics } from "../../lib/extension-diagnostics";
export const dynamic="force-dynamic";
export const metadata: Metadata = { title: "Dashboard · NAVI OS" };

export default async function Dashboard({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const {db}=await requireAccount(); await db.rpc("navi_touch_activity"); const query=await searchParams;
  return <div className="dashboard">
    <a className="dashboard-skip" href="#dashboard-main">Skip to dashboard</a>
    <header className="dashboard-nav"><a className="dashboard-brand" href="/">NAVI OS<span>●</span></a><nav aria-label="Dashboard"><a href="/#studio">Install extension ↗</a><a href="/">Back to website ↗</a><a href="/admin">Admin</a><form action={logout}><button type="submit">Log out</button></form></nav></header>
    <main id="dashboard-main"><div className="dashboard-intro"><span className="navi-eyebrow">YOUR BROWSER. YOUR AI. YOUR CONTROL.</span><h1>A little more<br/>in your flow<span>.</span></h1><p>Your local connection hub. Check the service, connect your extension, then use Chrome’s NAVI OS popup to authorize context and review suggestions.</p></div>
    {query.account_error&&<p role="alert">Sign-out could not be completed safely. Please retry after checking the account service.</p>}
    <AccountSettings />
    <AssistantPanel />
    <ConnectionPanel />
    <section className="dashboard-guide"><h2>From connection to context</h2><ol><li><strong>Load the extension.</strong> Build with <code>npm run build:extension</code>, then load <code>apps/extension/dist</code> at <code>chrome://extensions</code>.</li><li><strong>Configure the backend.</strong> Set <code>NAVI_EXTENSION_ID</code> in <code>apps/web/.env.local</code> and restart the web server. Use <code>http://localhost:3000</code>.</li><li><strong>Authorize deliberately.</strong> Open the popup on a normal tab. Enroll its metadata, allow page text separately, and connect the local backend.</li><li><strong>Review suggestions.</strong> Analyze one or two authorized pages. Opening selected searches requires a separate permission and explicit approval.</li></ol><a href="/#studio">Full installation guide ↗</a></section>
    </main><footer className="dashboard-footer">NAVI OS · Session permissions, explicit approvals, your control.</footer>
    <ExtensionDiagnostics />
  </div>;
}
