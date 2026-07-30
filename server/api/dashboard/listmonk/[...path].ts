import { getEffectiveListmonkProxyConfig, getListmonkApiBaseUrl, getListmonkBasicAuthHeader } from "../../../listmonk/config";

export default defineEventHandler(async (event) => {
  const path = (getRouterParam(event, "path") || "").replace(/^\/+/, "");
  const config = await getEffectiveListmonkProxyConfig();
  const target = `${getListmonkApiBaseUrl(config)}/${path}${getRequestURL(event).search}`;
  const headers = getProxyRequestHeaders(event);

  delete headers.host;
  delete headers.authorization;
  headers.authorization = getListmonkBasicAuthHeader(config);

  return proxyRequest(event, target, { headers });
});
