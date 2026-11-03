import {assistantRequestSchema,assistantPlanSchema,type AssistantRequest,type AssistantPlan} from "./assistant";
import {requestedNavigation,stripBuddyPrefix} from "./navigation";
import {ValidationError,type Schema} from "./schemas";
export const companionRequestSchema:Schema<AssistantRequest>={parse(value){const r=assistantRequestSchema.parse(value);if(r.tabs.some(t=>t.text)||r.instruction!==stripBuddyPrefix(r.instruction))throw new ValidationError("Companion accepts confirmed instructions and metadata only");return r;}};
export function validateCompanionPlan(plan:AssistantPlan,input:AssistantRequest){
 assistantPlanSchema.parse(plan);if(plan.actions.length>1)throw new ValidationError("Only one companion action at a time");
 for(const a of plan.actions){
  if(a.type==="open_url"){if(a.url!==requestedNavigation(input.instruction))throw new ValidationError("URL was not explicitly requested");}
  else if(a.type==="switch_tab"){if(!input.tabs.some(t=>t.tabId===a.tabId))throw new ValidationError("Unauthorized tab");}
  else if(a.type!=="search")throw new ValidationError("Unsupported companion action");
 }
}
