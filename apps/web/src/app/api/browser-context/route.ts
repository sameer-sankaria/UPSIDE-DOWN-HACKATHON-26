import { contextRequestSchema, analysisSchema } from "@navi-os/shared";
import { validatedPost } from "../../../server/api/validated";
import { analyzeBrowserContext } from "../../../server/modules/browser-context/service";
export const POST = validatedPost(contextRequestSchema, analysisSchema, analyzeBrowserContext);
