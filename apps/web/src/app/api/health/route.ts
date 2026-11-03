import { apiJson } from "../../../server/api/response";
import { getHealth } from "../../../server/modules/health/service";
export const dynamic = "force-dynamic";
export function GET() { return apiJson(getHealth()); }
