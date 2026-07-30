import { getActiveOutboundSettings, getOutboundSettingsView } from "../email/settings";

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return;
  const view = await getOutboundSettingsView();
  if (!view.configured) {
    console.warn("[plugin:email-config] No active outbound provider. Dashboard and API remain available for initial configuration.");
    return;
  }
  const active = await getActiveOutboundSettings();
  console.log(`[plugin:email-config] Validated database outbound provider ${active.config.EMAIL_PROVIDER} (version ${active.version})`);
});
