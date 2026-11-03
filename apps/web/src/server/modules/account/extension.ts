import {createHash,randomBytes} from "node:crypto";
import {serviceSupabase} from "../../../lib/supabase/service";
import {validAccount} from "./security";
export const digest=(text:string)=>createHash("sha256").update(text).digest("hex");
export const randomSecret=()=>randomBytes(32).toString("hex");
export function extensionRequest(request:Request) {
 const id=process.env.NAVI_EXTENSION_ID;const origin=request.headers.get("origin");
 return !!id&&/^[a-p]{32}$/.test(id)&&request.headers.get("x-navi-extension-id")===id&&(!origin||origin===`chrome-extension://${id}`);
}
export async function extensionIdentity(request:Request) {
 if(!extensionRequest(request))return null;
 const auth=request.headers.get("authorization");if(!auth||!/^Bearer [a-f0-9]{64}$/.test(auth))return null;
 try {
  const db=serviceSupabase();const {data,error}=await db.from("extension_sessions").select("user_id,expires_at,pairing_hash").eq("token_hash",digest(auth.slice(7))).eq("extension_id",process.env.NAVI_EXTENSION_ID!).gt("expires_at",new Date().toISOString()).maybeSingle();
  if(error||!data)return null;
  const result=await db.auth.admin.getUserById(data.user_id);if(result.error||!validAccount(result.data.user))return null;
  return {userId:data.user_id as string,db,pairingHash:data.pairing_hash as string|null,expiresAt:data.expires_at as string};
 }catch{return null;}
}
