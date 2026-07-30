import { getEffectiveListmonkProxyConfig, getListmonkApiBaseUrl, getListmonkBasicAuthHeader } from "../../../listmonk/config";
import { assertDashboardAdmin } from "../../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardAdmin(event);
  const config = await getEffectiveListmonkProxyConfig();
  const target = `${getListmonkApiBaseUrl(config)}${getRequestURL(event).search}`;
  const headers = getProxyRequestHeaders(event);

  delete headers.host;
  delete headers.authorization;
  headers.authorization = getListmonkBasicAuthHeader(config);

  return proxyRequest(event, target, { headers });
});
