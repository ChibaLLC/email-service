import { outboundSettingsInputSchema } from "../../../email/config";
import { saveOutboundSettings } from "../../../email/settings";
import { assertDashboardAdmin } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  const actor = await assertDashboardAdmin(event);
  const input = await readValidatedBody(event, outboundSettingsInputSchema.parse);
  try {
    return await saveOutboundSettings(actor.email, input);
  } catch (error) {
    throw createError({ statusCode: 400, message: error instanceof Error ? error.message : "Could not save outbound settings" });
  }
});
