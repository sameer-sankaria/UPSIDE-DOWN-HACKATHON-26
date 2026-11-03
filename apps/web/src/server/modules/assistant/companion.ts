import { companionRequestSchema, validateCompanionPlan, companionDestination, explicitTabAction, isSummaryRequest, isEmailRequest, requestedRecipient, emailDraftSchema, type CompanionRequest, type CompanionResponse, type AssistantPlan } from '@navi-os/shared';
import { generateGeminiPlan, generateGeminiDraft, type GeneratePlan, type GenerateDraft } from './provider';
function response(summary:string, actions:AssistantPlan['actions']=[], provider:'gemini'|'fallback'='fallback'):CompanionResponse {
 return {version:1,provider,notice:'Nothing has executed. Browser changes require a separate approval. A proposal is not an execution result.',plan:{version:1,summary,steps:actions.length?['Review the exact action before approving.']:[],actions}};
}
export async function companion(input:CompanionRequest, signal?:AbortSignal, generate:GeneratePlan=(r,s)=>generateGeminiPlan(r,s,true), draft:GenerateDraft=generateGeminiDraft):Promise<CompanionResponse> {
 input=companionRequestSchema.parse(input); if(signal?.aborted)throw new Error('Cancelled');
 const instruction=input.instruction;
 if(isEmailRequest(instruction)) {
  try { const generated=emailDraftSchema.parse(await draft(input,signal)); if(signal?.aborted)throw new Error('Cancelled');
   const to=requestedRecipient(instruction); if(generated.to && generated.to!==to)throw new Error('Recipient was not provided');
   return {...response(to?'Review and edit your email draft. Opening Gmail only creates a compose screen; sending remains your decision.':'What is the recipient’s email address? Enter it below, then review and edit this draft before opening Gmail.',[],'gemini'),draft:{...generated,to}};
  }catch{if(signal?.aborted)throw new Error('Cancelled');return response('Email drafting is unavailable. Please retry when Gemini is connected. Nothing was composed or sent.');}
 }
 if(isSummaryRequest(instruction)&&!input.tabs.some(t=>t.tabId===input.pageTabId&&t.text))return response('I need separate visible-page-text permission for the active enrolled tab. Open Controls, authorize this document, then select Summarize authorized page. No page was read.');
 if(/^(?:list|show|search|find)\s+(?:(?:my|open|permitted|authorized)\s+)*tabs?\b/i.test(instruction)) {
  const query=/\btabs?\s+(?:for|by title)\s+(.+)/i.exec(instruction)?.[1]?.toLowerCase();const tabs=input.tabs.filter(t=>!query||t.title.toLowerCase().includes(query));
  return response(tabs.length?tabs.map(t=>`#${t.tabId}: ${t.title.slice(0,120)} (${t.url.slice(0,160)})`).join('\n'):'No matching authorized tabs. Enroll tabs and enable metadata sharing; other tabs remain private.');
 }
 const tab=explicitTabAction(input);
 if(/^(?:switch|close)\b/i.test(instruction)&&!tab)return response('Which authorized tab do you mean? Use its exact tab number or an unambiguous title. List permitted tabs first if needed.');
 if(/\b(?:that tab|that song|this page|that page)\b/i.test(instruction)&&!isSummaryRequest(instruction)&&!companionDestination(input)&&!tab)return response('Which authorized page, tab or song do you mean? Please name it explicitly; I will not guess a destination.');
 try { const plan=await generate(input,signal);if(signal?.aborted)throw new Error('Cancelled');validateCompanionPlan(plan,input);return {...response(plan.summary,plan.actions,'gemini'),plan}; }
 catch {
  if(signal?.aborted)throw new Error('Cancelled');const target=companionDestination(input);
  const query=/^(?:please\s+)?search(?:\s+(?:for|the web for))?\s+(.+)$/i.exec(instruction)?.[1]?.trim();
  if(target)return response(target.includes('/results?')?'I can open these YouTube search results for your approval. Playback is not started or confirmed.':'I can propose that website for your approval.',[{type:'open_url',url:target}]);
  if(tab)return response('Review this action on the explicitly identified authorized tab.',[tab]);
  if(query&&query.length<=200)return response('I can propose this Google search for your approval.',[{type:'search',query}]);
  return response(isSummaryRequest(instruction)?'Gemini is unavailable. I cannot provide a page summary; retry later.':'Gemini chat is unavailable. Try a known website, a search, or retry later.');
 }
}
