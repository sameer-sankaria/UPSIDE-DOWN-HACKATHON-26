import {assistantResponseSchema,companionRequestSchema,validateCompanionPlan,requestedNavigation,stripBuddyPrefix,type AssistantResponse,type AssistantMode,isRecord} from "@navi-os/shared";
import type {ContextController} from "./controller";
import type {AssistantEngine} from "./assistant-engine";
import type {SessionStore} from "./session/state";
import {syncAccount} from "./account";
import {postBackend} from "./backend/client";
export type CompanionCommand=
 |{type:"COMPANION_CHAT";instruction:string;mode:AssistantMode;includeMetadata:boolean;consent:true}
 |{type:"COMPANION_APPROVE";planId:string;approved:true}
 |{type:"COMPANION_CANCEL"|"COMPANION_STATE"}
 |{type:"COMPANION_SWITCH_PERMISSION"|"COMPANION_OPEN_PERMISSION";enabled:boolean};
export function isPanelSender(sender:chrome.runtime.MessageSender){return sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL("sidepanel.html")&&!sender.tab;}
export function parseCompanionCommand(value:unknown):CompanionCommand{
 if(!isRecord(value))throw new Error("Invalid companion command");const keys=Object.keys(value).sort().join();
 if(value.type==="COMPANION_CHAT"&&keys==="consent,includeMetadata,instruction,mode,type"&&typeof value.instruction==="string"&&value.instruction.trim()&&value.instruction.length<=2000&&["SHOW_ME","DO_IT"].includes(value.mode as string)&&typeof value.includeMetadata==="boolean"&&value.consent===true)return value as CompanionCommand;
 if(value.type==="COMPANION_APPROVE"&&keys==="approved,planId,type"&&value.approved===true&&typeof value.planId==="string"&&/^[a-z0-9-]{1,80}$/.test(value.planId))return value as CompanionCommand;
 if((value.type==="COMPANION_CANCEL"||value.type==="COMPANION_STATE")&&keys==="type")return value as CompanionCommand;
 if((value.type==="COMPANION_SWITCH_PERMISSION"||value.type==="COMPANION_OPEN_PERMISSION")&&keys==="enabled,type"&&typeof value.enabled==="boolean")return value as CompanionCommand;
 throw new Error("Invalid companion command");
}
export class CompanionController{
 private abort?:AbortController;private epoch=0;
 constructor(private store:SessionStore,private context:ContextController,private engine:AssistantEngine,private post=postBackend,private authenticate=syncAccount,private serialize:<T>(work:()=>Promise<T>)=>Promise<T>=work=>work()){}
 stop(){this.epoch++;this.abort?.abort();this.engine.stop();}
 async dispatch(command:CompanionCommand,sender:chrome.runtime.MessageSender){
  if(!isPanelSender(sender))throw new Error("Forbidden companion sender");
  if(command.type==="COMPANION_CANCEL"){this.stop();const s=await this.store.load();delete s.companion;await this.store.save(s);return {cancelled:true};}
  if(command.type==="COMPANION_STATE"){const state=await this.store.load();return {opening:state.openTabsAllowed,switching:state.companionAllowSwitch??false};}
  const started=this.epoch;
  const account=await this.authenticate();
  if(started!==this.epoch)throw new Error("Request cancelled");
  if(command.type!=="COMPANION_CHAT")await this.context.applyAccountPreferences(account.preferences);
  if(command.type==="COMPANION_OPEN_PERMISSION"){await this.context.dispatch({type:"SET_OPEN_PERMISSION",enabled:command.enabled});return {saved:true};}
  if(command.type==="COMPANION_SWITCH_PERMISSION"){const s=await this.store.load();s.companionAllowSwitch=command.enabled;delete s.companion;await this.store.save(s);return {saved:true};}
  if(command.type==="COMPANION_APPROVE"){
   const s=await this.store.load();if(!s.companion||s.companion.accountUserId!==account.userId)throw new Error("Plan expired or rejected");
   return this.engine.handleNative({type:"NAVI_ASSISTANT_EXECUTE",token:s.companion.token,planId:command.planId,indices:[0],approved:true},sender);
  }
  if(command.type!=="COMPANION_CHAT")throw new Error("Invalid companion command");
  this.stop();const epoch=this.epoch;const abort=new AbortController();this.abort=abort;
  const instruction=stripBuddyPrefix(command.instruction);const target=requestedNavigation(instruction);
  const prepared=await this.serialize(async()=>{
    if(epoch!==this.epoch)throw new Error("Request cancelled");
    await this.context.applyAccountPreferences(account.preferences);
    const s=await this.store.load();
    if(!s.backendAllowed)throw new Error("Connect the local backend in Controls first.");
    s.companion={accountUserId:account.userId,token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join(""),expiresAt:Date.now()+1800000,allowManage:s.companionAllowSwitch??false,approvedUrls:target?[target]:[],results:[]};await this.store.save(s);
    const token=s.companion.token;
    const captured=await this.engine.handleNative({type:"NAVI_ASSISTANT_CONTEXT",token,contentTabIds:[]},sender) as {tabs:import("@navi-os/shared").TabContext[];contextId:string};
    return {token,captured};
  });
  const {token,captured}=prepared;
  const input=companionRequestSchema.parse({version:1,instruction,mode:command.mode,tabs:command.includeMetadata?captured.tabs:[]});
  const response:AssistantResponse=await this.post("/api/companion",input,assistantResponseSchema,true,abort.signal);
  if(epoch!==this.epoch||abort.signal.aborted)throw new Error("Request cancelled");
  validateCompanionPlan(response.plan,input);
  return this.serialize(async()=>{
    const current=await this.authenticate();if(current.userId!==account.userId||epoch!==this.epoch)throw new Error("Account changed or request cancelled. Request a new plan.");
    let planId:string|null=null;
    if(command.mode==="DO_IT"&&response.plan.actions.length){
      const staged=await this.engine.handleNative({type:"NAVI_ASSISTANT_STAGE",token,contextId:captured.contextId,mode:"DO_IT",plan:response.plan},sender) as {planId:string};planId=staged.planId;
    }
    return {response,planId};
  });
 }
}
