import assert from "node:assert/strict";
import {test} from "node:test";
import {safeNext,validAccount,validExtensionFlow,parsePreferences} from "../apps/web/src/server/modules/account/security";
import {issueReceipt,readReceipt} from "../apps/web/src/server/modules/account/receipts";
import {validateAuthCallback,challenge,readAccount} from "../apps/extension/src/account";
import {GET as accountGet,PUT as accountPut} from "../apps/web/src/app/api/account/route";
import {GET as extensionGet,POST as exchange} from "../apps/web/src/app/api/extension/session/route";
import {POST as complete} from "../apps/web/src/app/api/usage/complete/route";
import {requireAccount} from "../apps/web/src/server/modules/account/session";

test("auth redirect targets reject external, protocol-relative, encoded slash and backslash attacks",()=>{
 for(const value of ["https://evil.test","//evil.test","/\\evil.test","/\r\nevil",null,["/admin"]])assert.equal(safeNext(value),"/dashboard");
 assert.equal(safeNext("/extension/authorize?state=123"),"/extension/authorize?state=123");
});
test("only verified non-anonymous identities can authenticate",()=>{
 assert.equal(validAccount(null),false);assert.equal(validAccount({id:"user"}),false);assert.equal(validAccount({id:"user",email_confirmed_at:"now",is_anonymous:true}),false);assert.equal(validAccount({id:"user",email_confirmed_at:"now",is_anonymous:false}),true);
});
test("preference updates reject user IDs, admin flags, and unsupported modes",()=>{
 const prefs={ghost_mode_enabled:false,contextflow_enabled:true,preferred_ai_mode:"SHOW_ME",analytics_enabled:false};assert.deepEqual(parsePreferences(prefs),prefs);
 for(const value of [{...prefs,admin:true},{...prefs,user_id:"other"},{...prefs,preferred_ai_mode:"AUTO"},{...prefs,ghost_mode_enabled:"true"}])assert.throws(()=>parsePreferences(value));
});
test("extension authorization accepts only configured extension and bounded challenge/state",()=>{
 const previous=process.env.NAVI_EXTENSION_ID;process.env.NAVI_EXTENSION_ID="a".repeat(32);
 try{assert.equal(validExtensionFlow("a".repeat(32),"b".repeat(64),"c".repeat(64)),true);assert.equal(validExtensionFlow("b".repeat(32),"b".repeat(64),"c".repeat(64)),false);assert.equal(validExtensionFlow("a".repeat(32),"b","c"),false);}finally{if(previous===undefined)delete process.env.NAVI_EXTENSION_ID;else process.env.NAVI_EXTENSION_ID=previous;}
});
test("extension auth callback validates exact origin/path/state and SHA-256 proof",async()=>{
 const callback="https://"+"a".repeat(32)+".chromiumapp.org/navi";const state="b".repeat(64);const code="c".repeat(64);
 assert.equal(validateAuthCallback(callback+`?state=${state}&code=${code}`,callback,state),code);
 for(const value of ["https://evil.test/navi?state="+state+"&code="+code,callback+`?state=wrong&code=${code}`,callback+`/other?state=${state}&code=${code}`])assert.throws(()=>validateAuthCallback(value,callback,state));
 assert.equal(await challenge("abc"),"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("analytics receipts are signed, account-bound, and reject arbitrary event injection",()=>{
 const prev=process.env.SUPABASE_SERVICE_ROLE_KEY;process.env.SUPABASE_SERVICE_ROLE_KEY="test-only-secret-not-a-credential";
 try{const value=issueReceipt("alice","browser_action_completed");assert.equal(readReceipt(value,"alice").event,"browser_action_completed");assert.throws(()=>readReceipt(value,"bob"));assert.throws(()=>readReceipt(value+"tampered","alice"));assert.throws(()=>readReceipt({user_id:"bob",event_type:"user_login"},"alice"));}finally{if(prev===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=prev;}
});
test("missing account configuration fails closed for account APIs and protected pages",async()=>{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;delete process.env.NEXT_PUBLIC_SUPABASE_URL;delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 try{
  assert.equal((await accountGet()).status,401);
  assert.equal((await accountPut(new Request("http://localhost:3000/api/account",{method:"PUT",headers:{Origin:"https://evil.test"},body:"{}"}))).status,403);
  assert.equal((await extensionGet(new Request("http://localhost:3000/api/extension/session"))).status,401);
  assert.equal((await exchange(new Request("http://localhost:3000/api/extension/session",{method:"POST",body:"{}"}))).status,403);
  assert.equal((await complete(new Request("http://localhost:3000/api/usage/complete",{method:"POST",headers:{Origin:"http://localhost:3000"},body:'{"event_type":"user_login","user_id":"other"}'}))).status,401);
  await assert.rejects(()=>requireAccount(),/NEXT_REDIRECT/);
 }finally{if(url!==undefined)process.env.NEXT_PUBLIC_SUPABASE_URL=url;if(key!==undefined)process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=key;}
});
test("expired extension account tokens are erased from session storage",async()=>{
 let removed=false;(globalThis as any).chrome={storage:{session:{get:async()=>({naviAccount:{token:"a".repeat(64),userId:"user",expiresAt:1}}),remove:async()=>{removed=true;}}}};
 try{assert.equal(await readAccount(),null);assert.equal(removed,true);}finally{delete (globalThis as any).chrome;}
});

test("small account JSON reader rejects oversized and non-JSON requests before mutation",async()=>{
 const {smallJson}=await import("../apps/web/src/server/api/body");
 await assert.rejects(()=>smallJson(new Request("http://localhost:3000/api/account",{method:"PUT",headers:{"Content-Type":"application/json"},body:"x".repeat(100)}),32));
 await assert.rejects(()=>smallJson(new Request("http://localhost:3000/api/account",{method:"PUT",body:"{}"})));
 assert.deepEqual(await smallJson(new Request("http://localhost:3000/api/account",{method:"PUT",headers:{"Content-Type":"application/json"},body:'{"value":true}'})),{value:true});
});
