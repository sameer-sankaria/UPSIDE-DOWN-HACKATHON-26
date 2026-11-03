import {supabaseConfig} from "../../../lib/supabase/config";
import {accountSession} from "./session";
import {extensionIdentity} from "./extension";
/** Account data always fails closed. Legacy intelligence endpoints remain local-only when unconfigured. */
export async function requestActor(request:Request) {
 if(!supabaseConfig())return null;
 if(request.headers.has("x-navi-extension-id")) {
  const extension=await extensionIdentity(request);return extension?{userId:extension.userId,kind:"extension" as const}:null;
 }
 const session=await accountSession();return session?{userId:session.user.id,kind:"web" as const}:null;
}
