import { assistantPlanSchema, type AssistantPlan } from './assistant';
import { ValidationError } from './schemas';
import { conversationalRequestSchema, companionDestination, explicitTabAction, isSummaryRequest, isEmailRequest, type CompanionRequest } from './conversation';
export const companionRequestSchema = conversationalRequestSchema;
export function validateCompanionPlan(plan: AssistantPlan, input: CompanionRequest) {
 assistantPlanSchema.parse(plan); if (plan.actions.length > 1) throw new ValidationError('Only one companion action at a time');
 if ((isSummaryRequest(input.instruction) || isEmailRequest(input.instruction)) && plan.actions.length) throw new ValidationError('Read-only request cannot change Chrome');
 const target = companionDestination(input); const tab = explicitTabAction(input);
 for (const a of plan.actions) {
  if (a.type === 'open_url') { if (a.url !== target) throw new ValidationError('URL was not explicitly requested'); }
  else if (a.type === 'switch_tab' || a.type === 'close_tab') {
   if (!tab || tab.type !== a.type || !('tabId' in tab) || tab.tabId !== a.tabId) throw new ValidationError('Tab reference is missing or ambiguous');
  } else if (a.type === 'search') {
   const query = /^(?:please\s+)?search(?:\s+(?:for|the web for))?\s+(.+)$/i.exec(input.instruction)?.[1]?.trim();
   if (target || !query || a.query !== query) throw new ValidationError('Search must match the confirmed instruction');
  } else throw new ValidationError('Unsupported companion action');
 }
}
