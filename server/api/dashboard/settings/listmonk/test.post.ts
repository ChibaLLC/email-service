import { getEffectiveListmonkProxyConfig, getListmonkApiBaseUrl, getListmonkBasicAuthHeader } from "../../../../listmonk/config";
import { assertDashboardAdmin } from "../../../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardAdmin(event);
  const config = await getEffectiveListmonkProxyConfig();
  try {
    const response = await fetch(`${getListmonkApiBaseUrl(config)}/health`, {
      headers: { authorization: getListmonkBasicAuthHeader(config) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Listmonk returned HTTP ${response.status}`);
    return { success: true };
  } catch (error) {
    throw createError({ statusCode: 502, message: error instanceof Error ? error.message : "Could not connect to Listmonk" });
  }
});
