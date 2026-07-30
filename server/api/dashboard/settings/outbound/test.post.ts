import { testActiveOutboundSettings } from "../../../../email/settings";
import { assertDashboardAdmin } from "../../../../settings/policy";

export default defineEventHandler(async (event) => {
  const actor = await assertDashboardAdmin(event);
  try {
    return await testActiveOutboundSettings(actor.email);
  } catch {
    throw createError({ statusCode: 502, message: "Could not verify the active outbound provider connection" });
  }
});
