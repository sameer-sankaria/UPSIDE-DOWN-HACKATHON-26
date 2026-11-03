import { ghostRequestSchema, recommendationsSchema } from "@navi-os/shared";
import { validatedPost } from "../../../../server/api/validated";
import { ghostSuggestions } from "../../../../server/modules/ghost/service";
export const POST = validatedPost(ghostRequestSchema, recommendationsSchema, ghostSuggestions);
