import { verifyInboundConnection } from "../../../inbound/service";
import { assertInboundDashboardAdmin } from "../../../inbound/admin";

export default defineEventHandler(async (event) => {
  assertInboundDashboardAdmin(event);
  try {
    return await verifyInboundConnection();
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: error instanceof Error ? error.message : "Could not connect to the IMAP mailbox",
    });
  }
});
