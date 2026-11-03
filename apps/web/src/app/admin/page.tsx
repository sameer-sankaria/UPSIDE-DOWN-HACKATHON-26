import {requireAccount} from "../../server/modules/account/session";
import {notFound} from "next/navigation";
export const dynamic="force-dynamic";
interface Report{total_users:number;signups_7d:number;active_7d:number;ai_requests:number;extension_connections:number;users:{id:string;display_name:string;email:string;created_at:string;last_active_at:string|null}[]}
export default async function Admin(){
 const {db}=await requireAccount("/admin");const role=await db.rpc("navi_is_admin");if(role.error||role.data!==true)notFound();
 const {data,error}=await db.rpc("navi_admin_report");
 const report=data as Report|null;
 const date=(value:string|null)=>value?new Date(value).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"}):"Not yet active";
 return <div className="dashboard"><header className="dashboard-nav"><a className="dashboard-brand" href="/">NAVI OS ●</a><a href="/dashboard">Dashboard ↗</a></header><main><span className="navi-eyebrow">PRIVATE / ADMINISTRATOR</span><h1 className="admin-title">Account intelligence.</h1><p>Live database records. Activity uses authenticated account access; optional usage events include consenting users only.</p>
 {error||!report?<p role="alert">Reporting unavailable. Check the database migration and administrator assignment. No metrics have been substituted.</p>:<><div className="admin-metrics">{[["Registered users",report.total_users],["Signups / 7 days",report.signups_7d],["Active users / 7 days",report.active_7d],["Completed AI requests",report.ai_requests],["Extension connections",report.extension_connections]].map(([label,value])=><article key={label}><span>{label}</span><strong>{value}</strong></article>)}</div><h2>Recent signup activity & account management</h2><p>Latest 100 registered accounts. Dates shown in India Standard Time.</p><div className="admin-table"><table><thead><tr><th>Display name</th><th>Email</th><th>Signup date</th><th>Last activity</th></tr></thead><tbody>{report.users.map(user=><tr key={user.id}><td>{user.display_name||"Unnamed"}</td><td>{user.email}</td><td>{date(user.created_at)}</td><td>{date(user.last_active_at)}</td></tr>)}</tbody></table>{!report.users.length&&<p>No registered accounts found.</p>}</div></>}
 </main></div>;
}
