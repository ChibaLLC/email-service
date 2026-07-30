import { getInboundConfigView } from "../../inbound/config";
import { getInboundRuntimeStatus } from "../../inbound/service";
import { assertInboundDashboardAdmin } from "../../inbound/admin";

export default defineEventHandler(async (event) => {
  assertInboundDashboardAdmin(event);
  return {
    ...(await getInboundConfigView()),
    status: await getInboundRuntimeStatus(),
  };
});
