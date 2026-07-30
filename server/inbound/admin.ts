import type { H3Event } from "h3";
import { assertDashboardAdmin } from "../settings/policy";

export async function assertInboundDashboardAdmin(event: H3Event) {
  return assertDashboardAdmin(event);
}
