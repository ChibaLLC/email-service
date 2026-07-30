import { getInboundConfigView } from "../../inbound/config";
import { getInboundRuntimeStatus } from "../../inbound/service";
import { assertInboundDashboardAdmin, getInboundActor } from "../../inbound/admin";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  const actor = await getInboundActor(event);
  return {
    ...(await getInboundConfigView(actor)),
    status: await getInboundRuntimeStatus(),
  };
});
