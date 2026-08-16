import { getActiveOutboundSettings, getOutboundSettingsView } from "../email/settings";
import { issueDashboardBootstrapCode } from "../utils/dashboard-bootstrap";

export default defineNitroPlugin(async () => {
  if (import.meta.prerender) return;
  const view = await getOutboundSettingsView();
  if (!view.configured) {
    const bootstrapCode = await issueDashboardBootstrapCode();
    console.warn("[plugin:email-config] No active outbound provider. Use this one-time code on the dashboard setup form:");
    console.warn(`[plugin:email-config] ${bootstrapCode}`);
    return;
  }
  const active = await getActiveOutboundSettings();
  console.log(`[plugin:email-config] Validated database outbound provider ${active.config.EMAIL_PROVIDER} (version ${active.version})`);
});
