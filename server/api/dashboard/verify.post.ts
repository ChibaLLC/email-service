import { z } from "zod";
import { verifyOTP } from "../../utils/otp";
import { signJWT, getJWTSecret } from "../../utils/jwt";
import { validateEmail } from "~~/shared/utils/utils";
import { DASHBOARD_LOGGED_IN_COOKIE } from "~~/shared/utils/cookie";
import {
  DASHBOARD_COOKIE_NAME,
  getDashboardCookieOptions,
  getDashboardLoggedInCookieOptions,
} from "../../utils/cookie";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export default defineEventHandler(async (event) => {
  const { data, error } = await readValidatedBody(event, verifySchema.safeParse);

  if (error) {
    throw createError({
      statusCode: 400,
      message: "Email and 6-digit code are required",
    });
  }

  // Re-validate domain (defense in depth)
  const { valid } = validateEmail(data.email);
  if (!valid) {
    throw createError({ statusCode: 403, message: "Email domain not allowed" });
  }

  // Verify OTP
  const isValid = await verifyOTP(data.email, data.code);
  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: "Invalid or expired verification code",
    });
  }

  // Mint JWT
  const secret = getJWTSecret();
  const token = await signJWT({ email: data.email }, secret);

  // Set signed cookie
  setCookie(event, DASHBOARD_COOKIE_NAME, token, getDashboardCookieOptions());

  // Set non-HttpOnly cookie for client-side middleware
  setCookie(event, DASHBOARD_LOGGED_IN_COOKIE, "1", getDashboardLoggedInCookieOptions());

  return { success: true, email: data.email };
});
