import { assistantRequestSchema, assistantResponseSchema } from "@navi-os/shared";
import { validatedPost } from "../../../server/api/validated";
import { assistant } from "../../../server/modules/assistant/service";
export const runtime = "nodejs";
export const POST = validatedPost(assistantRequestSchema, assistantResponseSchema, assistant);
