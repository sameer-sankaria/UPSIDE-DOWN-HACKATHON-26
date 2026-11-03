import { WEB_ORIGIN } from "@navi-os/shared";
/** Development browser-origin boundary, not production user authentication. */
export function isAllowedApiClient(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === WEB_ORIGIN) return true;
  const id = process.env.NAVI_EXTENSION_ID;
  return !!id && /^[a-p]{32}$/.test(id) && request.headers.get("x-navi-extension-id") === id
    && (!origin || origin === `chrome-extension://${id}`);
}
