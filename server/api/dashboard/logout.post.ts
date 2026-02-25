import { DASHBOARD_COOKIE_NAME, getDashboardCookieOptions } from "../../utils/cookie";

export default defineEventHandler((event) => {
  deleteCookie(event, DASHBOARD_COOKIE_NAME, getDashboardCookieOptions({ maxAge: 0 }));

  return { success: true };
});
