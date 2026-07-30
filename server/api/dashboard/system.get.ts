import { env } from "std-env";
import { getOutboundSettingsView } from "../../email/settings";
import { getListmonkSettingsView } from "../../listmonk/config";
import { assertDashboardAdmin } from "../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardAdmin(event);
  const outbound = await getOutboundSettingsView();
  return {
    emailProvider: outbound.active?.provider || null,
    outbound,
    settingsEncryptionConfigured: Boolean(env.SETTINGS_ENCRYPTION_KEY),
    listmonk: await getListmonkSettingsView(),
  };
});
