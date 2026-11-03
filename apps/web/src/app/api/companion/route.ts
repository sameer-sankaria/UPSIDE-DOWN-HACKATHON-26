import {companionRequestSchema,companionResponseSchema} from "@navi-os/shared";
import {validatedPost} from "../../../server/api/validated";
import {companion} from "../../../server/modules/assistant/companion";
export const runtime="nodejs";
export const POST=validatedPost(companionRequestSchema,companionResponseSchema,companion);
