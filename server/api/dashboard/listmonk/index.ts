import { getEffectiveListmonkProxyConfig, getListmonkApiBaseUrl, getListmonkBasicAuthHeader } from "../../../listmonk/config";

export default defineEventHandler(async (event) => {
  const config = await getEffectiveListmonkProxyConfig();
  const target = `${getListmonkApiBaseUrl(config)}${getRequestURL(event).search}`;
  const headers = getProxyRequestHeaders(event);

  delete headers.host;
  delete headers.authorization;
  headers.authorization = getListmonkBasicAuthHeader(config);

  return proxyRequest(event, target, { headers });
});
