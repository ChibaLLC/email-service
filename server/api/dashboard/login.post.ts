import { z } from "zod";
import { render } from "@vue-email/render";
import { generateOTP } from "../../utils/otp";
import { getEmailProvider } from "../../email/providers";
import { validateEmail } from "~~/shared/utils/utils";
import OtpEmail from "../../emails/OtpEmail.vue";

const loginSchema = z.object({
  email: z.string().email(),
});

export default defineEventHandler(async (event) => {
  const { data, error } = await readValidatedBody(event, loginSchema.safeParse);

  if (error) {
    throw createError({ statusCode: 400, message: "Valid email is required" });
  }

  // Validate email domain against allow-list
  const { valid } = validateEmail(data.email);
  if (!valid) {
    throw createError({
      statusCode: 403,
      message: "Email domain not allowed. Must be from an approved organization.",
    });
  }

  // Generate OTP and render email
  const code = await generateOTP(data.email);
  const html = await render(OtpEmail, { code });

  // Send via provider
  const provider = getEmailProvider();
  await provider.send({
    to: data.email,
    subject: "Dashboard Login Code",
    html,
  });

  return { success: true, message: "Verification code sent to your email" };
});
