import { inboundConfigInputSchema, saveInboundConfig } from "../../inbound/config";
import { assertInboundDashboardAdmin } from "../../inbound/admin";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  const input = await readValidatedBody(event, inboundConfigInputSchema.parse);
  try {
    await saveInboundConfig(input);
    return { saved: true };
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : "Could not save inbound email configuration",
    });
  }
});
