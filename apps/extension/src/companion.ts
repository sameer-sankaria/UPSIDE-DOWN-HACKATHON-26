import { companionResponseSchema, companionRequestSchema, validateCompanionPlan, companionDestination, stripBuddyPrefix, isSummaryRequest, isEmailRequest, gmailComposeUrl, emailDraftSchema, safeNavigationUrl, type CompanionResponse, type CompanionRequest, type AssistantMode, type EmailDraft, isRecord } from '@navi-os/shared';
import type { ContextController } from './controller';
import type { AssistantEngine } from './assistant-engine';
import { pruneSession, SESSION_TTL, type SessionStore } from './session/state';
import { syncAccount } from './account';
import { postBackend } from './backend/client';
export type CompanionCommand=
 |{type:'COMPANION_CHAT';instruction:string;mode:AssistantMode;includeMetadata:boolean;consent:true;includePage?:boolean}
 |{type:'COMPANION_COMPOSE';draft:EmailDraft}
 |{type:'COMPANION_APPROVE';planId:string;approved:true}
 |{type:'COMPANION_CANCEL'|'COMPANION_CLEAR'|'COMPANION_STATE'}
 |{type:'COMPANION_SWITCH_PERMISSION'|'COMPANION_OPEN_PERMISSION'|'COMPANION_CLOSE_PERMISSION';enabled:boolean};
export function isPanelSender(sender:chrome.runtime.MessageSender){return sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL('sidepanel.html')&&!sender.tab;}
export function parseCompanionCommand(value:unknown):CompanionCommand {
 if(!isRecord(value))throw new Error('Invalid companion command'); const keys=Object.keys(value).sort().join();
 if(value.type==='COMPANION_CHAT'&&['consent,includeMetadata,instruction,mode,type','consent,includeMetadata,includePage,instruction,mode,type'].includes(keys)&&typeof value.instruction==='string'&&value.instruction.trim()&&value.instruction.length<=2000&&['SHOW_ME','DO_IT'].includes(value.mode as string)&&typeof value.includeMetadata==='boolean'&&(value.includePage===undefined||typeof value.includePage==='boolean')&&value.consent===true)return value as CompanionCommand;
 if(value.type==='COMPANION_COMPOSE'&&keys==='draft,type'){emailDraftSchema.parse(value.draft);return value as CompanionCommand;}
 if(value.type==='COMPANION_APPROVE'&&keys==='approved,planId,type'&&value.approved===true&&typeof value.planId==='string'&&/^[a-z0-9-]{1,80}$/.test(value.planId))return value as CompanionCommand;
 if(['COMPANION_CANCEL','COMPANION_CLEAR','COMPANION_STATE'].includes(value.type as string)&&keys==='type')return value as CompanionCommand;
 if(['COMPANION_SWITCH_PERMISSION','COMPANION_OPEN_PERMISSION','COMPANION_CLOSE_PERMISSION'].includes(value.type as string)&&keys==='enabled,type'&&typeof value.enabled==='boolean')return value as CompanionCommand;
 throw new Error('Invalid companion command');
}
export class CompanionController {
 private abort?:AbortController;private epoch=0;
 constructor(private store:SessionStore,private context:ContextController,private engine:AssistantEngine,private post=postBackend,private authenticate=syncAccount,private serialize:<T>(work:()=>Promise<T>)=>Promise<T>=work=>work()){}
 stop(){this.epoch++;this.abort?.abort();this.engine.stop();}
 async dispatch(command:CompanionCommand,sender:chrome.runtime.MessageSender) {
  if(!isPanelSender(sender))throw new Error('Forbidden companion sender');
  // Apply the same strict parser to direct callers and runtime messages.
  command=parseCompanionCommand(command);
  if(command.type==='COMPANION_CANCEL'||command.type==='COMPANION_CLEAR') {
   this.stop();const s=await this.store.load();delete s.companion;if(command.type==='COMPANION_CLEAR')delete s.companionConversation;await this.store.save(s);return {cancelled:true};
  }
  if(command.type==='COMPANION_STATE'){const s=pruneSession(await this.store.load(),Date.now());return {opening:s.openTabsAllowed,switching:s.companionAllowSwitch??false,closing:s.companionAllowClose??false};}
  const started=this.epoch; const account=await this.authenticate(); if(started!==this.epoch)throw new Error('Request cancelled');
  if(command.type!=='COMPANION_CHAT')await this.context.applyAccountPreferences(account.preferences);
  if(command.type==='COMPANION_OPEN_PERMISSION'){await this.context.dispatch({type:'SET_OPEN_PERMISSION',enabled:command.enabled});return {saved:true};}
  if(command.type==='COMPANION_SWITCH_PERMISSION'||command.type==='COMPANION_CLOSE_PERMISSION'){
   const s=await this.store.load();if(command.type==='COMPANION_SWITCH_PERMISSION')s.companionAllowSwitch=command.enabled;else s.companionAllowClose=command.enabled;delete s.companion;await this.store.save(s);return {saved:true};
  }
  if(command.type==='COMPANION_APPROVE'){
   const s=await this.store.load();if(!s.companion||s.companion.accountUserId!==account.userId)throw new Error('Plan expired or rejected');
   const result=await this.engine.handleNative({type:'NAVI_ASSISTANT_EXECUTE',token:s.companion.token,planId:command.planId,indices:[0],approved:true},sender) as {results:import('@navi-os/shared').ActionResult[]};
   const latest=await this.store.load();if(latest.companionConversation?.userId===account.userId){latest.companionConversation.turns.push({role:'result',text:result.results.map(r=>r.status+': '+r.detail).join('\n').slice(0,1200)});latest.companionConversation.turns=latest.companionConversation.turns.slice(-6);await this.store.save(latest);}return result;
  }
  if(command.type!=='COMPANION_CHAT'&&command.type!=='COMPANION_COMPOSE')throw new Error('Invalid companion request');
  const task=command;
  this.stop();const epoch=this.epoch;const abort=new AbortController();this.abort=abort;
  const compose=task.type==='COMPANION_COMPOSE';
  const instruction=compose?'Open the reviewed Gmail compose screen':stripBuddyPrefix(task.instruction);
  const prepared=await this.serialize(async()=>{
   if(epoch!==this.epoch)throw new Error('Request cancelled');await this.context.applyAccountPreferences(account.preferences);
   const s=pruneSession(await this.store.load(),Date.now());if(!s.backendAllowed)throw new Error('Connect the local backend in Controls first.');
   delete s.companion;await this.store.save(s);
   const history=s.companionConversation?.userId===account.userId?s.companionConversation.turns:[];
   const target=compose?safeNavigationUrl(gmailComposeUrl(task.draft)):companionDestination({version:1,mode:task.mode,instruction,tabs:[],history});
   s.companion={accountUserId:account.userId,token:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),expiresAt:Date.now()+SESSION_TTL,allowManage:s.companionAllowSwitch??false,allowClose:s.companionAllowClose??false,approvedUrls:target?[target]:[],results:[]};await this.store.save(s);
   let pageTabId:number|undefined;
   if(!compose&&task.includePage){
    if(!isSummaryRequest(instruction))throw new Error('Page text can be shared only for an explicit summary request.');
    const [active]=await chrome.tabs.query({active:true,currentWindow:true});
    if(active?.id===undefined||!s.tabs[active.id]?.content)throw new Error('The active page needs separate metadata and visible-text permission in Controls.');pageTabId=active.id;
   }
   const token=s.companion.token;
   const captured=await this.engine.handleNative({type:'NAVI_ASSISTANT_CONTEXT',token,contentTabIds:pageTabId===undefined?[]:[pageTabId]},sender) as {tabs:import('@navi-os/shared').TabContext[];contextId:string};
   const tabs=compose?[]:task.includeMetadata?captured.tabs:captured.tabs.filter(t=>t.tabId===pageTabId);
   return {token,captured,input:companionRequestSchema.parse({version:1,instruction,mode:compose?'DO_IT':task.mode,tabs,...(history.length?{history}:{}),...(pageTabId===undefined?{}:{pageTabId})}),target};
  });
  const {token,captured,input,target}=prepared;
  const response:CompanionResponse=compose?{version:1,provider:'fallback',notice:'Review the destination before approving. Gmail will open a compose screen; NAVI cannot send email.',plan:{version:1,summary:'Open your edited draft in Gmail. Sending requires your own action in Gmail.',steps:[],actions:[{type:'open_url',url:target!}]}}:await this.post('/api/companion',input,companionResponseSchema,true,abort.signal);
  if(epoch!==this.epoch||abort.signal.aborted)throw new Error('Request cancelled');if(!compose)validateCompanionPlan(response.plan,input);
  return this.serialize(async()=>{
   const current=await this.authenticate();if(current.userId!==account.userId||epoch!==this.epoch)throw new Error('Account changed or request cancelled. Request a new plan.');
   // Revalidate the exact document snapshots even for read-only summary responses.
   await this.engine.handleNative({type:'NAVI_ASSISTANT_VALIDATE',token,contextId:captured.contextId},sender);
   let planId:string|null=null;
   if(input.mode==='DO_IT'&&response.plan.actions.length){const staged=await this.engine.handleNative({type:'NAVI_ASSISTANT_STAGE',token,contextId:captured.contextId,mode:'DO_IT',plan:response.plan},sender) as {planId:string};planId=staged.planId;}
   const latest=await this.store.load();
   // Page summaries and email bodies never enter retained conversation context.
   if(!compose&&input.pageTabId===undefined&&!isEmailRequest(instruction)){latest.companionConversation={userId:account.userId,expiresAt:Date.now()+SESSION_TTL,turns:[...(input.history??[]),{role:'user' as const,text:instruction.slice(0,1200)},{role:'assistant' as const,text:response.plan.summary.slice(0,1200)}].slice(-6)};await this.store.save(latest);}
   return {response,planId};
  });
 }
}
