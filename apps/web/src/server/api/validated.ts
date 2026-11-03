import { ValidationError, type Schema } from "@navi-os/shared";
import { apiJson } from "./response";
import { isAllowedApiClient } from "../modules/permissions/api-access";
const MAX_BYTES = 32768;
class HttpError extends Error { constructor(public status: number, public code: string) { super(code); } }
export function validatedPost<I, O>(input: Schema<I>, output: Schema<O>, service: (value: I, signal?: AbortSignal) => O | Promise<O>) {
  return async function POST(request: Request): Promise<Response> {
    try {
      if (!isAllowedApiClient(request)) throw new HttpError(403, "FORBIDDEN");
      if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new HttpError(415, "JSON_REQUIRED");
      if (Number(request.headers.get("content-length")) > MAX_BYTES) throw new HttpError(413, "BODY_TOO_LARGE");
      if (!request.body) throw new HttpError(400, "INVALID_REQUEST");
      const reader = request.body.getReader();
      const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          size += part.value.byteLength;
          if (size > MAX_BYTES) { await reader.cancel(); throw new HttpError(413, "BODY_TOO_LARGE"); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      let body: unknown;
      try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
      catch { throw new HttpError(400, "INVALID_JSON"); }
      let parsed: I;
      try { parsed = input.parse(body); }
      catch (error) { if (error instanceof ValidationError) throw new HttpError(400, "INVALID_REQUEST"); throw error; }
      return apiJson(output.parse(await service(parsed, request.signal)));
    } catch (error) {
      if (error instanceof HttpError) return apiJson({ error: { code: error.code } }, error.status);
      // No request bodies, text, titles, or raw URLs are logged or persisted.
      return apiJson({ error: { code: "INTERNAL_ERROR" } }, 500);
    }
  };
}
