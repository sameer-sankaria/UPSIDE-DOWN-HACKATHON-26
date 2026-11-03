import {createHmac,randomUUID,timingSafeEqual} from "node:crypto";
interface Receipt{uid:string;event:"browser_action_completed"|"contextflow_suggestion_accepted";nonce:string;exp:number}
function secret(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error("Server services unavailable");return key;}
export function issueReceipt(uid:string,event:Receipt["event"]){
 const payload=Buffer.from(JSON.stringify({uid,event,nonce:randomUUID(),exp:Date.now()+300000})).toString("base64url");
 return payload+"."+createHmac("sha256",secret()).update("navi-usage-v1:"+payload).digest("base64url");
}
export function readReceipt(value:unknown,uid:string):Receipt{
 if(typeof value!=="string"||value.length>1024)throw new Error("Invalid receipt");const [payload,signature,...extra]=value.split(".");if(!payload||!signature||extra.length)throw new Error("Invalid receipt");
 const expected=createHmac("sha256",secret()).update("navi-usage-v1:"+payload).digest();const actual=Buffer.from(signature,"base64url");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error("Invalid receipt");
 const body=JSON.parse(Buffer.from(payload,"base64url").toString()) as Receipt;
 if(body.uid!==uid||!["browser_action_completed","contextflow_suggestion_accepted"].includes(body.event)||typeof body.exp!=="number"||body.exp<=Date.now()||!/^[a-f0-9-]{36}$/.test(body.nonce))throw new Error("Invalid receipt");return body;
}
