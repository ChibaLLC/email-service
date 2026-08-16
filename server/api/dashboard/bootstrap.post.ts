import { z } from "zod";
import { DASHBOARD_LOGGED_IN_COOKIE } from "~~/shared/utils/cookie";
import { getOutboundSettingsView } from "../../email/settings";
import { readLimitedJsonBody } from "../../security/body";
import { isDashboardBootstrapOwner } from "../../settings/policy";
import { consumeDashboardBootstrapCode } from "../../utils/dashboard-bootstrap";
import {
  DASHBOARD_COOKIE_NAME,
  getDashboardCookieOptions,
  getDashboardLoggedInCookieOptions,
} from "../../utils/cookie";
import { getJWTSecret, signJWT } from "../../utils/jwt";

const bootstrapSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().min(1).max(128),
});

export default defineEventHandler(async (event) => {
  const { data, error } = bootstrapSchema.safeParse(await readLimitedJsonBody(event, 4096));
  if (error) throw createError({ statusCode: 400, message: "Owner email and setup code are required" });

  if ((await getOutboundSettingsView()).configured) {
    throw createError({ statusCode: 409, message: "Initial dashboard setup is already complete" });
  }

  if (!isDashboardBootstrapOwner(data.email)) {
    throw createError({ statusCode: 401, message: "Invalid owner email or setup code" });
  }

  const token = await signJWT({ email: data.email }, getJWTSecret());
  if (!(await consumeDashboardBootstrapCode(data.code))) {
    throw createError({ statusCode: 401, message: "Invalid owner email or setup code" });
  }
  setCookie(event, DASHBOARD_COOKIE_NAME, token, getDashboardCookieOptions());
  setCookie(event, DASHBOARD_LOGGED_IN_COOKIE, "1", getDashboardLoggedInCookieOptions());

  return { success: true, email: data.email };
});
