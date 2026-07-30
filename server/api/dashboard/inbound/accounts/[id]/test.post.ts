import { assertInboundDashboardAdmin } from "../../../../../inbound/admin";
import { verifyInboundConnection } from "../../../../../inbound/service";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  try {
    return await verifyInboundConnection(getRouterParam(event, "id") || "");
  } catch (error) {
    throw createError({ statusCode: 502, message: error instanceof Error ? error.message : "Could not connect to the IMAP account" });
  }
});
