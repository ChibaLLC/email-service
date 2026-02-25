import {
  DASHBOARD_COOKIE_NAME,
  getDashboardCookieOptions,
  getDashboardLoggedInCookieOptions,
} from "../../utils/cookie";
import { DASHBOARD_LOGGED_IN_COOKIE } from "~~/shared/utils/cookie";

export default defineEventHandler((event) => {
  deleteCookie(event, DASHBOARD_COOKIE_NAME, getDashboardCookieOptions({ maxAge: 0 }));
  deleteCookie(event, DASHBOARD_LOGGED_IN_COOKIE, getDashboardLoggedInCookieOptions({ maxAge: 0 }));

  return { success: true };
});
