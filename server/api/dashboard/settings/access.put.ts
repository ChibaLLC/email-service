import { accessSettingsInputSchema, assertDashboardOwner, getAccessSettings, saveAccessSettings } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  const actor = await assertDashboardOwner(event);
  const input = await readValidatedBody(event, accessSettingsInputSchema.parse);
  await saveAccessSettings(actor.email, input);
  return getAccessSettings();
});
