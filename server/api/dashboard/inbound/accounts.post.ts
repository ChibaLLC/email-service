import { assertInboundDashboardAdmin } from "../../../inbound/admin";
import { inboundAccountInputSchema, saveInboundAccount } from "../../../inbound/config";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  const input = await readValidatedBody(event, inboundAccountInputSchema.parse);
  try {
    return await saveInboundAccount(undefined, input);
  } catch (error) {
    throw createError({ statusCode: 400, message: error instanceof Error ? error.message : "Could not create inbound account" });
  }
});
