import { assertInboundDashboardAdmin } from "../../../../../inbound/admin";
import { verifyInboundWebhook } from "../../../../../inbound/service";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  try {
    return await verifyInboundWebhook(getRouterParam(event, "id") || "");
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: error instanceof Error ? error.message : "Could not reach the webhook destination",
    });
  }
});
