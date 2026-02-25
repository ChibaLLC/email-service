import { z } from "zod";

/**
 * Get the list of allowed email domains from env or defaults.
 */
export function getAllowedDomains(): string[] {
  const envDomains = process.env.ALLOWED_DOMAINS || process.env.NUXT_PUBLIC_ALLOWED_DOMAINS;
  if (envDomains) {
    return envDomains
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  return ["ifkafin.com", "finueva.com", "heilomeet.com"];
}

export type EmailValidationResult = {
  valid: boolean;
  type: string | undefined;
};

export function validateEmail(email: string): EmailValidationResult {
  if (!email) return { valid: false, type: undefined };

  const allowedDomains = getAllowedDomains();
  const emailLower = email.toLowerCase();

  for (const domain of allowedDomains) {
    if (emailLower.endsWith(`@${domain}`) || emailLower.endsWith(`.${domain}`)) {
      return { valid: true, type: domain.split(".")[0] };
    }
  }

  return {
    valid: false,
    type: undefined,
  };
}

export const emailShema = z.object({
  email: z
    .string()
    .email()
    .refine((email) => validateEmail(email).valid, "Your email needs to be from a pre-approved organisation."),
});
