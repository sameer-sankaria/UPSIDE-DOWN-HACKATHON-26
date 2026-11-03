import {accountSession} from "../../../../server/modules/account/session";
import {authOrigin} from "../../../../server/modules/account/security";
import {serviceSupabase} from "../../../../lib/supabase/service";
import {digest} from "../../../../server/modules/account/extension";
import {smallJson} from "../../../../server/api/body";
import {apiJson} from "../../../../server/api/response";
export async function POST(request:Request){
 if(request.headers.get("origin")!==authOrigin())return apiJson({error:{code:"FORBIDDEN"}},403);
 const session=await accountSession();if(!session)return apiJson({error:{code:"UNAUTHENTICATED"}},401);
 try{const body=await smallJson(request,1024) as Record<string,unknown>;
 if(!body||Object.keys(body).join()!=="pairingToken"||typeof body.pairingToken!=="string"||!/^[a-f0-9]{64}$/.test(body.pairingToken))throw new Error();
 const {data,error}=await serviceSupabase().from("extension_sessions").update({pairing_hash:digest(body.pairingToken)}).eq("user_id",session.user.id).eq("extension_id",process.env.NAVI_EXTENSION_ID??"").gt("expires_at",new Date().toISOString()).select("user_id");
 if(error||!data?.length)return apiJson({error:{code:"EXTENSION_ACCOUNT_REQUIRED"}},403);
 return apiJson({linked:true});
 }catch{return apiJson({error:{code:"ACCOUNT_LINK_UNAVAILABLE"}},400);}
}
