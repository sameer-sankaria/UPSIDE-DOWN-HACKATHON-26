import {WEB_ORIGIN} from "@navi-os/shared";
export interface AccountPreferences{ghost_mode_enabled:boolean;contextflow_enabled:boolean;preferred_ai_mode:"SHOW_ME"|"DO_IT";analytics_enabled:boolean}
interface ExtensionAccount{token:string;userId:string;expiresAt:number;preferences?:AccountPreferences}
function secret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");}
export async function challenge(verifier:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(verifier))),b=>b.toString(16).padStart(2,"0")).join("");}
export function validateAuthCallback(callback:string,expected:string,state:string){
 const url=new URL(callback);const target=new URL(expected);
 if(url.origin!==target.origin||url.pathname!==target.pathname||url.searchParams.get("state")!==state||!/^([a-f0-9]{64})$/.test(url.searchParams.get("code")??""))throw new Error("Invalid extension authentication callback");
 return url.searchParams.get("code")!;
}
export async function readAccount():Promise<ExtensionAccount|null>{
 try{const data=await chrome.storage.session.get("naviAccount");const account=data.naviAccount as ExtensionAccount|undefined;
 if(!account||account.expiresAt<=Date.now()||!/^([a-f0-9]{64})$/.test(account.token)){if(account)await chrome.storage.session.remove("naviAccount");return null;}return account;}catch{return null;}
}
async function call(path:string,method:string,body?:unknown,token?:string,pairingHash?:string){
 if(!await chrome.permissions.contains({origins:["http://localhost/*"]}))throw new Error("Connect the local backend first.");
 const response=await fetch(WEB_ORIGIN+path,{method,headers:{"Content-Type":"application/json","X-Navi-Extension-Id":chrome.runtime.id,...(token?{Authorization:`Bearer ${token}`} : {}),...(pairingHash?{"X-Navi-Pairing-Hash":pairingHash}:{})},...(body?{body:JSON.stringify(body)}:{}),credentials:"omit",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000)});
 if(!response.ok){if(response.status===401)await chrome.storage.session.remove("naviAccount");throw new Error("Account connection expired or unavailable. Sign in again.");}
 const text=await response.text();if(text.length>4096)throw new Error("Account response too large");return JSON.parse(text);
}
export async function signInAccount(){
 const verifier=secret(),state=secret(),redirect=chrome.identity.getRedirectURL("navi");
 const url=new URL(WEB_ORIGIN+"/extension/authorize");url.searchParams.set("extension_id",chrome.runtime.id);url.searchParams.set("challenge",await challenge(verifier));url.searchParams.set("state",state);
 const callback=await chrome.identity.launchWebAuthFlow({url:url.href,interactive:true});if(!callback)throw new Error("Authentication cancelled");
 const code=validateAuthCallback(callback,redirect,state);const data=await call("/api/extension/session","POST",{code,verifier});
 if(!/^([a-f0-9]{64})$/.test(data.token)||typeof data.userId!=="string"||typeof data.expiresAt!=="number"||data.expiresAt<=Date.now()||data.expiresAt>Date.now()+3605000)throw new Error("Invalid account session");
 await chrome.storage.session.set({naviAccount:{token:data.token,userId:data.userId,expiresAt:data.expiresAt}});
 return syncAccount();
}
export async function syncAccount(pairingToken?:string){
 const account=await readAccount();if(!account)throw new Error("Sign in to your NAVI OS account first.");
 const data=await call("/api/extension/session","GET",undefined,account.token,pairingToken?await challenge(pairingToken):undefined);const p=data.preferences;
 if(data.userId!==account.userId||!p||typeof p.ghost_mode_enabled!=="boolean"||typeof p.contextflow_enabled!=="boolean"||typeof p.analytics_enabled!=="boolean"||!["SHOW_ME","DO_IT"].includes(p.preferred_ai_mode))throw new Error("Invalid account preferences");
 await chrome.storage.session.set({naviAccount:{...account,preferences:p}});return {userId:account.userId,expiresAt:account.expiresAt,preferences:p as AccountPreferences};
}
export async function signOutAccount(){
 const account=await readAccount();
 try{if(account)await call("/api/extension/session","DELETE",undefined,account.token);}finally{await chrome.storage.session.remove("naviAccount");}
}
export async function completeUsage(receipt:string){
 try{const account=await readAccount();if(account)await call("/api/usage/complete","POST",{receipt},account.token);}catch{/* Optional analytics never blocks approved work. */}
}
