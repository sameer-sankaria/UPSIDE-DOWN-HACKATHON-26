"use server";
import {redirect} from "next/navigation";
import {requireAccount} from "../../../server/modules/account/session";
import {validExtensionFlow} from "../../../server/modules/account/security";
import {serviceSupabase} from "../../../lib/supabase/service";
import {digest,randomSecret} from "../../../server/modules/account/extension";
export async function authorizeExtension(form:FormData){
 const id=String(form.get("extension_id"));const challenge=String(form.get("challenge"));const state=String(form.get("state"));
 const {user}=await requireAccount();
 if(!validExtensionFlow(id,challenge,state))redirect("/extension/authorize?error=invalid");
 const code=randomSecret();let ok=false;
 try{const db=serviceSupabase();await db.from("extension_auth_codes").delete().eq("user_id",user.id);const result=await db.from("extension_auth_codes").insert({code_hash:digest(code),user_id:user.id,challenge,extension_id:id});ok=!result.error;}catch{}
 if(!ok)redirect("/extension/authorize?error=unavailable");
 const callback=new URL(`https://${id}.chromiumapp.org/navi`);callback.searchParams.set("code",code);callback.searchParams.set("state",state);
 redirect(callback.href);
}
