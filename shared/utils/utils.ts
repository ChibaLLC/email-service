import { z } from "zod";

export const emailShema = z.object({
  email: z
    .string()
    .email()
    .refine((email) => validateEmail(email).valid, "Your email needs to be from a pre-approved organisation. :("),
});

export type EmailValidationResult = {
  valid: boolean;
  type: string | undefined;
};

export function validateEmail(email: string): EmailValidationResult {
  if (!email) return { valid: false, type: undefined };
  const allowedending = ["ifkafin.com", "finueva.com", "heilomeet.com"] as const;

  for (const ending of allowedending) {
    if (email.endsWith(ending)) {
      return { valid: true, type: ending.split(".")[0] };
    }
  }

  return {
    valid: false,
    type: email.split(".")[0],
  };
}
