import { getListmonkApiBaseUrl, getListmonkBasicAuthHeader } from "../../../listmonk/config";

export default defineEventHandler(async (event) => {
  const path = (getRouterParam(event, "path") || "").replace(/^\/+/, "");
  const target = `${getListmonkApiBaseUrl()}/${path}${getRequestURL(event).search}`;
  const headers = getProxyRequestHeaders(event);

  delete headers.host;
  delete headers.authorization;
  headers.authorization = getListmonkBasicAuthHeader();

  return proxyRequest(event, target, { headers });
});