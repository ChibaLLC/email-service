const MAX_REQUEST_BYTES = 22_000_000;

export default defineEventHandler((event) => {
  const method = getMethod(event);
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;

  const length = Number(getHeader(event, "content-length") || 0);
  if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
    throw createError({ statusCode: 413, message: "Request body is too large" });
  }

  if (!getRequestURL(event).pathname.startsWith("/api/dashboard")) return;
  const origin = getHeader(event, "origin");
  if (!origin) return;
  const requestUrl = getRequestURL(event);
  const forwardedHost = getHeader(event, "x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = getHeader(event, "x-forwarded-proto")?.split(",")[0]?.trim();
  const expectedOrigin = forwardedHost ? `${forwardedProto || requestUrl.protocol.slice(0, -1)}://${forwardedHost}` : requestUrl.origin;
  if (origin !== expectedOrigin) throw createError({ statusCode: 403, message: "Cross-origin dashboard request rejected" });
});
