import {companionRequestSchema,validateCompanionPlan,requestedNavigation,type AssistantRequest,type AssistantResponse} from "@navi-os/shared";
import {generateGeminiPlan,type GeneratePlan} from "./provider";
export async function companion(input:AssistantRequest,signal?:AbortSignal,generate:GeneratePlan=(r,s)=>generateGeminiPlan(r,s,true)):Promise<AssistantResponse>{
 input=companionRequestSchema.parse(input);
 try{const plan=await generate(input,signal);validateCompanionPlan(plan,input);return {version:1,provider:"gemini",notice:"Nothing has executed. Approve any proposed action separately.",plan};}
 catch{
  if(signal?.aborted)throw new Error("Cancelled");
  let url:string|null=null;try{url=requestedNavigation(input.instruction);}catch{}
  const query=/^(?:please\s+)?search(?:\s+(?:for|the web for))?\s+(.+)$/i.exec(input.instruction)?.[1]?.slice(0,200);
  return {version:1,provider:"fallback",notice:"Gemini is unavailable or returned an unsupported plan. This is a deterministic navigation fallback.",plan:{version:1,summary:url?"I can propose that website for your approval.":query?"I can propose this Google search for your approval.":"Gemini chat is unavailable. Try a known website or a simple search, or retry later.",steps:["Review the proposed action. Approval is required before Chrome changes."],actions:url?[{type:"open_url",url}]:query?[{type:"search",query}]:[]}};
 }
}
