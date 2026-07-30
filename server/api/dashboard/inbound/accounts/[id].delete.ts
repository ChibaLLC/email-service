import { assertInboundDashboardAdmin } from "../../../../inbound/admin";
import { deleteInboundAccount } from "../../../../inbound/config";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  try {
    await deleteInboundAccount(getRouterParam(event, "id") || "");
    return { deleted: true };
  } catch (error) {
    throw createError({ statusCode: 404, message: error instanceof Error ? error.message : "Could not delete inbound account" });
  }
});
