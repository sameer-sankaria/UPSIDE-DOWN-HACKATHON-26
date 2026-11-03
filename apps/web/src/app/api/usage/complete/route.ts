import {smallJson} from "../../../../server/api/body";
import {apiJson} from "../../../../server/api/response";
import {isAllowedApiClient} from "../../../../server/modules/permissions/api-access";
import {requestActor} from "../../../../server/modules/account/actor";
import {readReceipt} from "../../../../server/modules/account/receipts";
import {serviceSupabase} from "../../../../lib/supabase/service";
export async function POST(request:Request){
 if(!isAllowedApiClient(request))return apiJson({error:{code:"FORBIDDEN"}},403);
 const actor=await requestActor(request);if(!actor)return apiJson({error:{code:"UNAUTHENTICATED"}},401);
 try{const body=await smallJson(request,2048) as Record<string,unknown>;if(!body||Object.keys(body).join()!=="receipt")throw new Error();
 const receipt=readReceipt(body.receipt,actor.userId);const {error}=await serviceSupabase().rpc("navi_redeem_usage",{p_nonce:receipt.nonce,p_user_id:actor.userId,p_event_type:receipt.event});
 if(error)throw new Error();return apiJson({accepted:true});
 }catch{return apiJson({error:{code:"INVALID_RECEIPT"}},400);}
}
