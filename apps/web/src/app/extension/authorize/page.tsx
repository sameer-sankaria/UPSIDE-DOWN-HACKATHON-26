import {requireAccount} from "../../../server/modules/account/session";
import {validExtensionFlow} from "../../../server/modules/account/security";
import {authorizeExtension} from "./actions";
export default async function ExtensionAuthorize({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const q=await searchParams;const params=new URLSearchParams();for(const key of ["extension_id","challenge","state"])if(q[key])params.set(key,q[key]!);
 const {user}=await requireAccount("/extension/authorize?"+params.toString());const valid=validExtensionFlow(q.extension_id,q.challenge,q.state);
 return <main className="account-shell"><a className="dashboard-brand" href="/">NAVI OS ●</a><section className="account-card"><span className="navi-eyebrow">EXTENSION / ACCOUNT CONNECTION</span><h1>Connect your workspace.</h1><p>Signed in as {user.email}. Connect the configured NAVI OS extension to your account for one hour. It can sync your preferences and associate approved feature activity with this account. Browser permissions remain separate.</p>
 {!valid||q.error?<p role="alert">Authorization is invalid or unavailable. Start Sign in from the extension again. The operator must configure the extension ID and server account services.</p>:<form action={authorizeExtension}>{["extension_id","challenge","state"].map(key=><input key={key} type="hidden" name={key} value={q[key]}/>)}<p>No Supabase access or refresh token is sent to the extension. Ghost Mode will not be enabled by signing in.</p><button type="submit">Approve extension account connection</button></form>}<a href="/dashboard">Cancel and return to dashboard</a></section></main>;
}
