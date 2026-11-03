import {smallJson} from "../../../server/api/body";
import {apiJson} from "../../../server/api/response";
import {accountSession} from "../../../server/modules/account/session";
import {parsePreferences,authOrigin} from "../../../server/modules/account/security";
export async function GET() {
 const session=await accountSession();if(!session)return apiJson({error:{code:"UNAUTHENTICATED"}},401);
 const {db,user}=session;
 const [profile,prefs]=await Promise.all([db.from("profiles").select("display_name,last_active_at").eq("id",user.id).single(),db.from("user_preferences").select("ghost_mode_enabled,contextflow_enabled,preferred_ai_mode,analytics_enabled").eq("user_id",user.id).single()]);
 if(profile.error||prefs.error)return apiJson({error:{code:"ACCOUNT_DATA_UNAVAILABLE"}},503);
 await db.rpc("navi_touch_activity");
 return apiJson({profile:profile.data,preferences:prefs.data});
}
export async function PUT(request:Request) {
 if(request.headers.get("origin")!==authOrigin())return apiJson({error:{code:"FORBIDDEN"}},403);
 const session=await accountSession();if(!session)return apiJson({error:{code:"UNAUTHENTICATED"}},401);
 try {
  const body=await smallJson(request) as Record<string,unknown>;
  if(!body||typeof body!=="object"||Object.keys(body).sort().join()!=="display_name,preferences"||typeof body.display_name!=="string"||!body.display_name.trim()||body.display_name.length>100)throw new Error();
  const prefs=parsePreferences(body.preferences);
  const [a,b]=await Promise.all([session.db.from("profiles").update({display_name:body.display_name.trim()}).eq("id",session.user.id),session.db.from("user_preferences").update(prefs).eq("user_id",session.user.id)]);
  if(a.error||b.error)return apiJson({error:{code:"SAVE_FAILED"}},503);
  return apiJson({saved:true});
 }catch{return apiJson({error:{code:"INVALID_REQUEST"}},400);}
}
