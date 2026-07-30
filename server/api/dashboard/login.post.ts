import { z } from "zod";
import { render } from "@vue-email/render";
import { generateOTP } from "../../utils/otp";
import { getEmailProviderForSettings } from "../../email/settings";
import OtpEmail from "../../emails/OtpEmail.vue";
import { isLoginEmailAllowed } from "../../settings/policy";
import { enforceRateLimit, requestSource } from "../../security/rate-limit";
import { readLimitedJsonBody } from "../../security/body";

const loginSchema = z.object({
  email: z.string().email(),
});

export default defineEventHandler(async (event) => {
  const { data, error } = loginSchema.safeParse(await readLimitedJsonBody(event, 4096));

  if (error) {
    throw createError({ statusCode: 400, message: "Valid email is required" });
  }

  const email = data.email.trim().toLowerCase();
  await Promise.all([
    enforceRateLimit("dashboard-login-email", email, 5, 15 * 60),
    enforceRateLimit("dashboard-login-source", requestSource(event), 200, 15 * 60),
  ]);
  if (!(await isLoginEmailAllowed(email))) {
    throw createError({
      statusCode: 403,
      message: "Email domain not allowed. Must be from an approved organization.",
    });
  }

  const { provider } = await getEmailProviderForSettings();

  // Generate OTP and render email
  const code = await generateOTP(email);
  const html = await render(OtpEmail, { code });

  // Send via provider
  const result = await provider.send({
    to: email,
    subject: "Dashboard Login Code",
    html,
  });
  if (!result.success) {
    console.error("[dashboard-login] OTP delivery failed", result.error);
    throw createError({ statusCode: 502, message: "Could not send login code" });
  }

  return { success: true, message: "Verification code sent to your email" };
});
