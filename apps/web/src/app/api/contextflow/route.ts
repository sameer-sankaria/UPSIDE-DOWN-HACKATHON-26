import { contextRequestSchema, recommendationsSchema } from "@navi-os/shared";
import { validatedPost } from "../../../server/api/validated";
import { aiContextFlow } from "../../../server/modules/assistant/recommendations";
import { contextFlow } from "../../../server/modules/context-flow/service";
export const POST = (request: Request) => validatedPost(contextRequestSchema, recommendationsSchema, (input, signal) => request.headers.get("x-navi-ai-consent") === "yes" ? aiContextFlow(input, signal) : contextFlow(input))(request);
