import { getOutboundSettingsView } from "../../../email/settings";
import { assertDashboardAdmin } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardAdmin(event);
  return getOutboundSettingsView();
});
