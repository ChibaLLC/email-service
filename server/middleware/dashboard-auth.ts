import { verifyJWT, getJWTSecret } from "../utils/jwt";
import { DASHBOARD_COOKIE_NAME } from "../utils/cookie";

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Routes that require dashboard authentication
  const protectedPrefixes = ["/api/dashboard", "/api/keys"];
  // Routes that are exempt from auth (login/verify/logout)
  const publicPaths = ["/api/dashboard/login", "/api/dashboard/verify", "/api/dashboard/logout"];

  const isProtected = protectedPrefixes.some((p) => path.startsWith(p));
  const isPublic = publicPaths.some((p) => path.startsWith(p));

  if (!isProtected || isPublic) return;

  // Read JWT from cookie
  const token = getCookie(event, DASHBOARD_COOKIE_NAME);
  if (!token) {
    throw createError({
      statusCode: 401,
      message: "Authentication required. Please log in.",
    });
  }

  try {
    const secret = getJWTSecret();
    const payload = await verifyJWT(token, secret);

    // Attach user info to event context
    event.context.dashboardUser = {
      email: payload.email,
      iat: payload.iat,
      exp: payload.exp,
    };
  } catch {
    // Clear invalid cookie
    deleteCookie(event, DASHBOARD_COOKIE_NAME, { path: "/" });
    throw createError({
      statusCode: 401,
      message: "Session expired or invalid. Please log in again.",
    });
  }
});
