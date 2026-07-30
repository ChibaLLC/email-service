import { getListmonkSettingsView, listmonkSettingsInputSchema, saveListmonkSettings } from "../../../listmonk/config";
import { assertDashboardAdmin } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  const actor = await assertDashboardAdmin(event);
  const input = await readValidatedBody(event, listmonkSettingsInputSchema.parse);
  try {
    await saveListmonkSettings(actor.email, input);
    return getListmonkSettingsView();
  } catch (error) {
    throw createError({ statusCode: 400, message: error instanceof Error ? error.message : "Could not save Listmonk settings" });
  }
});
