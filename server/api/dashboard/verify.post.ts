import { z } from "zod";
import { verifyOTP } from "../../utils/otp";
import { signJWT, getJWTSecret } from "../../utils/jwt";
import { DASHBOARD_LOGGED_IN_COOKIE } from "~~/shared/utils/cookie";
import { isLoginEmailAllowed } from "../../settings/policy";
import {
  DASHBOARD_COOKIE_NAME,
  getDashboardCookieOptions,
  getDashboardLoggedInCookieOptions,
} from "../../utils/cookie";
import { enforceRateLimit, requestSource } from "../../security/rate-limit";
import { readLimitedJsonBody } from "../../security/body";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export default defineEventHandler(async (event) => {
  const { data, error } = verifySchema.safeParse(await readLimitedJsonBody(event, 4096));

  if (error) {
    throw createError({
      statusCode: 400,
      message: "Email and 6-digit code are required",
    });
  }

  const email = data.email.trim().toLowerCase();
  await Promise.all([
    enforceRateLimit("dashboard-verify-email", email, 10, 15 * 60),
    enforceRateLimit("dashboard-verify-source", requestSource(event), 300, 15 * 60),
  ]);
  if (!(await isLoginEmailAllowed(email))) {
    throw createError({ statusCode: 403, message: "Email domain not allowed" });
  }

  // Verify OTP
  const isValid = await verifyOTP(email, data.code);
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: "Invalid or expired verification code",
    });
  }

  // Mint JWT
  const secret = getJWTSecret();
  const token = await signJWT({ email }, secret);

  // Set signed cookie
  setCookie(event, DASHBOARD_COOKIE_NAME, token, getDashboardCookieOptions());

  // Set non-HttpOnly cookie for client-side middleware
  setCookie(event, DASHBOARD_LOGGED_IN_COOKIE, "1", getDashboardLoggedInCookieOptions());

  return { success: true, email };
});
