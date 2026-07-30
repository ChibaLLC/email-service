import { getListmonkSettingsView } from "../../../listmonk/config";
import { assertDashboardAdmin } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardAdmin(event);
  return getListmonkSettingsView();
});
