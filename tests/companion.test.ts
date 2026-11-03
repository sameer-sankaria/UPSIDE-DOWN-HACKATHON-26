import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {safeNavigationUrl,requestedNavigation,stripBuddyPrefix,assistantPlanSchema,validatePlanContext,validateCompanionPlan,companionRequestSchema,type AssistantPlan,type AssistantRequest} from "@navi-os/shared";
import {companion} from "../apps/web/src/server/modules/assistant/companion";
import {CompanionController,isPanelSender,parseCompanionCommand} from "../apps/extension/src/companion";
import {AssistantEngine} from "../apps/extension/src/assistant-engine";
import {ContextController} from "../apps/extension/src/controller";
import {emptySession} from "../apps/extension/src/session/state";
import {VoiceInput,type Recognition,type VoiceState} from "../apps/extension/src/voice";
const root=new URL("../",import.meta.url);
const sender={id:"a".repeat(32),url:"chrome-extension://"+"a".repeat(32)+"/sidepanel.html"};
const input:AssistantRequest={version:1,mode:"DO_IT",instruction:"open YouTube",tabs:[]};
const plan:AssistantPlan={version:1,summary:"Open the requested website",steps:["Review and approve"],actions:[{type:"open_url",url:"https://www.youtube.com/"}]};

test("manifest registers side panel, toolbar activation and customizable Chrome shortcut",()=>{
 const manifest=JSON.parse(readFileSync(new URL("apps/extension/manifest.json",root),"utf8"));assert.ok(manifest.permissions.includes("sidePanel"));assert.equal(manifest.side_panel.default_path,"sidepanel.html");assert.equal(manifest.action.default_popup,undefined);assert.equal(manifest.commands["open-companion"].suggested_key.default,"Ctrl+Shift+Y");assert.equal(manifest.commands["open-companion"].suggested_key.mac,"Command+Shift+Y");
 const source=readFileSync(new URL("apps/extension/src/background.ts",root),"utf8");assert.match(source,/openPanelOnActionClick:true/);assert.match(source,/commands.onCommand.addListener/);
 const build=readFileSync(new URL("apps/extension/scripts/build.mjs",root),"utf8");assert.match(build,/sidepanel\.ts/);assert.match(build,/sidepanel\.html/);
});
for(const [command,url] of [["Hey Buddy, open YouTube.","https://www.youtube.com/"],["Open Instagram","https://www.instagram.com/"],["Open Gmail","https://mail.google.com/"],["open https://example.com/docs?q=react","https://example.com/docs?q=react"]])test(`navigation resolves ${command}`,()=>assert.equal(requestedNavigation(command!),url));
for(const url of ["javascript:alert(1)","data:text/html,x","http://example.com","https://user:pass@example.com","https://localhost","https://127.0.0.1","https://[::1]","https://service.internal","https://foo.local","https://example.com:8443","https://example.com\\@evil.test","file:///tmp/secret"])test(`reject unsafe navigation ${url}`,()=>assert.throws(()=>safeNavigationUrl(url)));

test("model cannot substitute a destination, expand dashboard authority, read text or plan autonomous steps",()=>{
 assert.equal(stripBuddyPrefix("Hey Buddy! Search for React"),"Search for React");
 const parsed=assistantPlanSchema.parse(plan);assert.throws(()=>validatePlanContext(parsed,[]));validateCompanionPlan(parsed,input);
 assert.throws(()=>validateCompanionPlan({...plan,actions:[{type:"open_url",url:"https://evil.test/"}]},input));
 assert.throws(()=>validateCompanionPlan({...plan,actions:[...plan.actions,...plan.actions]},input));
 assert.throws(()=>validateCompanionPlan({...plan,actions:[{type:"group_tabs",tabIds:[1,2],title:"x"}]},input));
 assert.throws(()=>companionRequestSchema.parse({...input,tabs:[{tabId:1,url:"https://example.com",title:"Test",text:"Page content",capturedAt:1}]}));
});

test("side-panel messaging rejects webpages, other extension pages, forged fields, missing consent and implicit approval",()=>{
 (globalThis as any).chrome={runtime:{id:sender.id,getURL:(path:string)=>`chrome-extension://${sender.id}/${path}`}};
 try{
 assert.equal(isPanelSender(sender),true);for(const other of [{...sender,url:"https://example.com"},{...sender,id:"other"},{...sender,tab:{id:1}},{...sender,url:sender.url+"?spoof=1"}])assert.equal(isPanelSender(other as any),false);
 assert.throws(()=>parseCompanionCommand({type:"COMPANION_CHAT",instruction:"x",mode:"DO_IT",includeMetadata:false,consent:false}));
 assert.throws(()=>parseCompanionCommand({type:"COMPANION_APPROVE",planId:"plan",approved:false}));
 assert.throws(()=>parseCompanionCommand({type:"COMPANION_CHAT",instruction:"x",mode:"DO_IT",includeMetadata:false,consent:true,actions:["evil"]}));
 }finally{delete (globalThis as any).chrome;}
});

test("Gemini chat and failures use the shared pipeline and honest navigation-only fallback",async()=>{
 const chat=await companion({...input,instruction:"Hello"},undefined,async()=>({...plan,summary:"Hello!",actions:[]}));assert.equal(chat.provider,"gemini");assert.equal(chat.plan.actions.length,0);
 const fallback=await companion(input,undefined,async()=>{throw new Error("secret API error");});assert.equal(fallback.provider,"fallback");assert.deepEqual(fallback.plan.actions,plan.actions);assert.doesNotMatch(JSON.stringify(fallback),/secret API error/);
 const invalid=await companion(input,undefined,async()=>({...plan,actions:[{type:"open_url",url:"https://evil.test/"}]}));assert.equal(invalid.provider,"fallback");assert.deepEqual(invalid.plan.actions,plan.actions);
 await assert.rejects(()=>companion(input,AbortSignal.abort(),async()=>{throw new Error("abort");}),/Cancelled/);
});
function fixture(responsePlan=plan){
 let state=emptySession();state.backendAllowed=true;state.openTabsAllowed=true;const calls:any[]=[];const tabs=new Map<number,any>();
 const chrome={runtime:{id:sender.id,getURL:(path:string)=>`chrome-extension://${sender.id}/${path}`},permissions:{contains:async()=>true},tabs:{get:async(id:number)=>{if(!tabs.has(id))throw new Error("Missing tab");return {...tabs.get(id)};},create:async(options:any)=>{calls.push(options);const tab={id:99,url:new URL(options.url).href};tabs.set(99,tab);return tab;},update:async(id:number,options:any)=>{Object.assign(tabs.get(id),options);return tabs.get(id);}}};(globalThis as any).chrome=chrome;
 const store={load:async()=>structuredClone(state),save:async(value:typeof state)=>{state=structuredClone(value);}};
 const context=new ContextController(store);const engine=new AssistantEngine(store,context);
 const authenticate=async()=>({userId:"alice",expiresAt:Date.now()+100000,preferences:{ghost_mode_enabled:false,contextflow_enabled:true,preferred_ai_mode:"SHOW_ME" as const,analytics_enabled:false}});
 const post:any=async(_path:string,body:AssistantRequest,schema:any)=>{assert.ok(body.tabs.every(t=>!t.text));return schema.parse({version:1,provider:"gemini",notice:"Nothing executed",plan:responsePlan});};
 const controller=new CompanionController(store,context,engine,post,authenticate);
 const chat=(mode:"DO_IT"|"SHOW_ME"="DO_IT")=>controller.dispatch({type:"COMPANION_CHAT",instruction:"Hey Buddy, open YouTube",mode,includeMetadata:false,consent:true},sender) as Promise<any>;
 return {controller,context,engine,store,authenticate,post,chat,chrome,calls,tabs,state:()=>state};
}
test("native companion reuses the action engine, requires approval, verifies Chrome, and prevents replay",async()=>{
 const f=fixture();const result=await f.chat();assert.equal(f.calls.length,0);assert.ok(result.planId);assert.equal(f.state().assistant,undefined);
 const execution:any=await f.controller.dispatch({type:"COMPANION_APPROVE",planId:result.planId,approved:true},sender);assert.equal(execution.results[0].status,"verified");assert.equal(f.calls[0].url,"https://www.youtube.com/");
 await assert.rejects(()=>f.controller.dispatch({type:"COMPANION_APPROVE",planId:result.planId,approved:true},sender));
});
test("SHOW ME and rejection cannot execute changes",async()=>{
 const f=fixture();assert.equal((await f.chat("SHOW_ME")).planId,null);const result=await f.chat();await f.controller.dispatch({type:"COMPANION_CANCEL"},sender);await assert.rejects(()=>f.controller.dispatch({type:"COMPANION_APPROVE",planId:result.planId,approved:true},sender));assert.equal(f.calls.length,0);
});
test("opening and verification permission denial happen before any Chrome mutation",async()=>{
 const f=fixture();const result=await f.chat();const state=f.state();state.openTabsAllowed=false;await f.store.save(state);await assert.rejects(()=>f.controller.dispatch({type:"COMPANION_APPROVE",planId:result.planId,approved:true},sender),/permission/);assert.equal(f.calls.length,0);
 const g=fixture();const pending=await g.chat();g.chrome.permissions.contains=async()=>false;await assert.rejects(()=>g.controller.dispatch({type:"COMPANION_APPROVE",planId:pending.planId,approved:true},sender),/verification/);assert.equal(g.calls.length,0);
});
test("unauthenticated companion cannot capture context or call Gemini",async()=>{
 const f=fixture();let sent=false;const c=new CompanionController(f.store,f.context,f.engine,(async()=>{sent=true;}) as any,async()=>{throw new Error("Sign in first");});await assert.rejects(()=>c.dispatch({type:"COMPANION_CHAT",instruction:"Hello",mode:"SHOW_ME",includeMetadata:false,consent:true},sender),/Sign in/);assert.equal(sent,false);assert.equal(f.state().companion,undefined);
});
test("cancellation aborts an in-flight model request and never stages a late result",async()=>{
 const f=fixture();let started!:()=>void;const ready=new Promise<void>(r=>{started=r;});const c=new CompanionController(f.store,f.context,f.engine,((path:any,body:any,schema:any,consent:any,signal:AbortSignal)=>new Promise((resolve,reject)=>{started();signal.addEventListener("abort",()=>reject(new Error("Request cancelled")),{once:true});})) as any,f.authenticate);
 const running=c.dispatch({type:"COMPANION_CHAT",instruction:"open YouTube",mode:"DO_IT",includeMetadata:false,consent:true},sender);await ready;await c.dispatch({type:"COMPANION_CANCEL"},sender);await assert.rejects(()=>running,/cancelled/);assert.equal(f.state().companion,undefined);assert.equal(f.calls.length,0);
});
function voiceFixture(){let recognizer:Recognition;let stopped=0;let starts=0;const states:VoiceState[]=[];
 const v=new VoiceInput(()=>{recognizer={continuous:true,interimResults:false,lang:"",onresult:null,onerror:null,onend:null,start(){starts++;},stop(){this.onend?.();},abort(){this.onend?.();}};return recognizer;},async()=>({getTracks:()=>[{stop(){stopped++;}}]}),state=>states.push(state));return {v,states,recognizer:()=>recognizer!,stopped:()=>stopped,starts:()=>starts};}
test("voice is push-to-talk, single utterance, stops tracks, and returns an editable transcript without submitting",async()=>{
 const f=voiceFixture();assert.equal(f.starts(),0);await f.v.start();assert.equal(f.starts(),1);assert.equal(f.stopped(),1);assert.equal(f.recognizer().continuous,false);f.recognizer().onresult?.({results:[[{transcript:"Hey Buddy open Gmail"}]]});f.v.stop();assert.equal(f.states.at(-1)?.state,"transcript");assert.equal(f.states.at(-1)?.text,"Hey Buddy open Gmail");f.v.cancel();assert.equal(f.states.at(-1)?.state,"idle");
});
test("voice denial, unsupported recognition and late permission after cancellation are safe",async()=>{
 const states:VoiceState[]=[];const unsupported=new VoiceInput(undefined,async()=>{throw new Error("should not request");},s=>states.push(s));await unsupported.start();assert.equal(states.at(-1)?.state,"error");
 const denied=new VoiceInput(()=>({} as Recognition),async()=>{throw new Error("permission");},s=>states.push(s));await denied.start();assert.match(states.at(-1)?.error??"",/denied/);
 let grant!:(stream:any)=>void;let created=false,stopped=false;const delayed=new VoiceInput(()=>{created=true;return {} as Recognition;},()=>new Promise(resolve=>{grant=resolve;}),s=>states.push(s));const pending=delayed.start();delayed.cancel();grant({getTracks:()=>[{stop(){stopped=true;}}]});await pending;assert.equal(created,false);assert.equal(stopped,true);
});
test("recognition errors never restart listening in the background",async()=>{
 const f=voiceFixture();await f.v.start();f.recognizer().onerror?.({error:"not-allowed"});assert.equal(f.states.at(-1)?.state,"error");assert.match(f.states.at(-1)?.error??"",/denied/);assert.equal(f.starts(),1);
});

test("switching targets only enrolled metadata and needs its own explicit grant",async()=>{
 const f=fixture({...plan,actions:[{type:"switch_tab",tabId:1}]});const state=f.state();state.tabs[1]={id:1,title:"GitHub",url:"https://github.com",origin:"https://github.com",windowId:1,expiresAt:Date.now()+60000};await f.store.save(state);f.tabs.set(1,{id:1,title:"GitHub",url:"https://github.com/repo",windowId:1,active:false});
 const command={type:"COMPANION_CHAT" as const,instruction:"Switch to my GitHub tab",mode:"DO_IT" as const,includeMetadata:true,consent:true as const};
 const first:any=await f.controller.dispatch(command,sender);await assert.rejects(()=>f.controller.dispatch({type:"COMPANION_APPROVE",planId:first.planId,approved:true},sender),/permission/);
 await f.controller.dispatch({type:"COMPANION_SWITCH_PERMISSION",enabled:true},sender);const next:any=await f.controller.dispatch(command,sender);const result:any=await f.controller.dispatch({type:"COMPANION_APPROVE",planId:next.planId,approved:true},sender);assert.equal(result.results[0].status,"verified");assert.equal(f.tabs.get(1).active,true);
});

test("microphone shutdown tolerates recognizer state errors",async()=>{
 const f=voiceFixture();await f.v.start();f.recognizer().stop=()=>{throw new Error("already stopped");};f.recognizer().abort=()=>{throw new Error("already aborted");};assert.doesNotThrow(()=>f.v.stop());assert.equal(f.states.at(-1)?.state,"idle");
});

test("rendered side-panel chat presents approval before sending an execution message",async()=>{
 const {JSDOM}=await import("jsdom");const {build}=await import("esbuild");
 const bundled=await build({entryPoints:[new URL("apps/extension/src/sidepanel.ts",root).pathname],bundle:true,write:false,format:"iife",platform:"browser",target:"chrome120"});
 const dom=new JSDOM(readFileSync(new URL("apps/extension/sidepanel.html",root),"utf8"),{runScripts:"outside-only",url:sender.url});const calls:any[]=[];
 Object.defineProperty(dom.window.HTMLElement.prototype,"scrollIntoView",{value(){}});
 (dom.window as any).chrome={runtime:{sendMessage:async(command:any)=>{calls.push(command);if(command.type==="COMPANION_CHAT")return {ok:true,data:{response:{version:1,provider:"gemini",notice:"Review first",plan},planId:"approved-plan"}};if(command.type==="COMPANION_APPROVE")return {ok:true,data:{results:[{index:0,status:"verified",detail:"Chrome confirmed the URL"}]}};return {ok:true,data:{cancelled:true}};}},permissions:{request:async()=>true}};
 dom.window.eval(bundled.outputFiles![0]!.text);
 const doc=dom.window.document;(doc.getElementById("instruction") as HTMLTextAreaElement).value="Hey Buddy, open YouTube";(doc.getElementById("mode") as HTMLSelectElement).value="DO_IT";(doc.getElementById("consent") as HTMLInputElement).checked=true;
 doc.getElementById("chat")!.dispatchEvent(new dom.window.Event("submit",{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));
 const relevant=calls.filter(c=>c.type!=="COMPANION_STATE");assert.equal(relevant.length,1);assert.equal(relevant[0].type,"COMPANION_CHAT");assert.equal(relevant[0].instruction,"open YouTube");assert.equal((doc.getElementById("approval") as HTMLElement).hidden,false);assert.match(doc.getElementById("approval")!.textContent!,/youtube\.com/);
 (doc.querySelector("#approval button") as HTMLButtonElement).click();await new Promise(r=>setTimeout(r,0));const approved=calls.find(c=>c.type==="COMPANION_APPROVE");assert.ok(approved);assert.equal(approved.approved,true);assert.match(doc.getElementById("messages")!.textContent!,/VERIFIED/);
 dom.window.close();
});
