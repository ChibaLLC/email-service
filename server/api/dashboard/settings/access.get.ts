import { assertDashboardOwner, getAccessSettings } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardOwner(event);
  return getAccessSettings();
});
