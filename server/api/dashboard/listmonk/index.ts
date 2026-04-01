import { getListmonkApiBaseUrl, getListmonkBasicAuthHeader } from "../../../listmonk/config";

export default defineEventHandler(async (event) => {
  const target = `${getListmonkApiBaseUrl()}${getRequestURL(event).search}`;
  const headers = getProxyRequestHeaders(event);

  delete headers.host;
  delete headers.authorization;
  headers.authorization = getListmonkBasicAuthHeader();

  return proxyRequest(event, target, { headers });
});