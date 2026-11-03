import { contextRequestSchema, recommendationsSchema } from "@navi-os/shared";
import { validatedPost } from "../../../server/api/validated";
import { contextFlow } from "../../../server/modules/context-flow/service";
export const POST = validatedPost(contextRequestSchema, recommendationsSchema, contextFlow);
