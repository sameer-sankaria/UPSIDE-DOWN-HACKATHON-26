import { assistantRequestSchema, assistantPlanSchema, validatePlanContext, sanitizeText, type AssistantRequest, type AssistantResponse } from "@navi-os/shared";
import { generateGeminiPlan, type GeneratePlan } from "./provider";
export async function assistant(input: AssistantRequest, signal?: AbortSignal, generate: GeneratePlan = generateGeminiPlan): Promise<AssistantResponse> {
  input = assistantRequestSchema.parse(input);
  try {
    const plan = assistantPlanSchema.parse(await generate(input, signal)); validatePlanContext(plan, input.tabs);
    return { version: 1, provider: "gemini", notice: "Page content is untrusted evidence. Review every proposed action.", plan };
  } catch {
    if (signal?.aborted) throw new Error("Cancelled");
    const query = sanitizeText(input.instruction, 200).replace(/[<>\r\n]/g, "");
    return { version: 1, provider: "fallback", notice: "Gemini is unavailable or its response was rejected. No model-generated summary is available.", plan: {
      version: 1, summary: `Deterministic fallback. ${input.tabs.length} authorized tab(s) supplied. Existing ContextFlow and Ghost suggestions remain available in the extension.`,
      steps: ["Review the authorized context and proposed searches.", "Approve only the actions you want, or retry Gemini later."],
      actions: /\b(search|find|look up)\b/i.test(input.instruction) && query ? [{ type: "search", query }] : [],
    } };
  }
}
