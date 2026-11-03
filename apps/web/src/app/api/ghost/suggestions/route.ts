import { ghostRequestSchema, recommendationsSchema } from "@navi-os/shared";
import { validatedPost } from "../../../../server/api/validated";
import { aiGhost } from "../../../../server/modules/assistant/recommendations";
import { ghostSuggestions } from "../../../../server/modules/ghost/service";
export const POST = (request: Request) => validatedPost(ghostRequestSchema, recommendationsSchema, (input, signal) => request.headers.get("x-navi-ai-consent") === "yes" ? aiGhost(input, signal) : ghostSuggestions(input))(request);
