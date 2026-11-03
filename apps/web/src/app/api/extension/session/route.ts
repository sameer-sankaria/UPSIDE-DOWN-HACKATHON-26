import {smallJson} from "../../../../server/api/body";
import {apiJson} from "../../../../server/api/response";
import {extensionRequest,extensionIdentity,digest,randomSecret} from "../../../../server/modules/account/extension";
import {serviceSupabase} from "../../../../lib/supabase/service";
import {recordUsage} from "../../../../server/modules/account/analytics";
export async function POST(request:Request){
 if(!extensionRequest(request))return apiJson({error:{code:"FORBIDDEN"}},403);
 try{
  const body=await smallJson(request,2048) as Record<string,string>;
  if(!body||Object.keys(body).sort().join()!=="code,verifier"||typeof body.code!=="string"||typeof body.verifier!=="string"||!/^([a-f0-9]{64})$/.test(body.code)||!/^([a-f0-9]{64})$/.test(body.verifier))throw new Error();
  const token=randomSecret();const db=serviceSupabase();const {data,error}=await db.rpc("navi_exchange_extension",{p_code_hash:digest(body.code),p_challenge:digest(body.verifier),p_extension_id:process.env.NAVI_EXTENSION_ID,p_token_hash:digest(token)});
  if(error||typeof data!=="string")return apiJson({error:{code:"INVALID_AUTHORIZATION_CODE"}},401);
  await recordUsage(data,"extension_connected");
  return apiJson({token,userId:data,expiresAt:Date.now()+3600000});
 }catch{return apiJson({error:{code:"EXTENSION_AUTH_UNAVAILABLE"}},400);}
}
export async function GET(request:Request){
 const identity=await extensionIdentity(request);if(!identity)return apiJson({error:{code:"UNAUTHENTICATED"}},401);
 const pairing=request.headers.get("x-navi-pairing-hash");if(pairing&&pairing!==identity.pairingHash)return apiJson({error:{code:"ACCOUNT_PAIRING_MISMATCH"}},403);
 const {data,error}=await identity.db.from("user_preferences").select("ghost_mode_enabled,contextflow_enabled,preferred_ai_mode,analytics_enabled").eq("user_id",identity.userId).single();
 if(error)return apiJson({error:{code:"PREFERENCES_UNAVAILABLE"}},503);
 await identity.db.from("profiles").update({last_active_at:new Date().toISOString()}).eq("id",identity.userId);
 return apiJson({userId:identity.userId,expiresAt:Date.parse(identity.expiresAt),preferences:data});
}
export async function DELETE(request:Request){
 const identity=await extensionIdentity(request);if(!identity)return apiJson({error:{code:"UNAUTHENTICATED"}},401);
 const {error}=await identity.db.from("extension_sessions").delete().eq("token_hash",digest(request.headers.get("authorization")!.slice(7)));
 return error?apiJson({error:{code:"REVOCATION_FAILED"}},503):apiJson({signedOut:true});
}
