import { z } from "zod";

export const emailProviderNames = ["nodemailer", "resend", "sendgrid", "mailchimp", "postal"] as const;
export type EmailProviderName = (typeof emailProviderNames)[number];

const requiredString = (name: string) => z.string({ required_error: `${name} is required` }).trim().min(1, `${name} is required`);
const requiredEmail = (name: string) => requiredString(name).email(`${name} must be a valid email address`);
const optionalEmail = z.string().trim().email("defaultFrom must be a valid email address").optional();
const apiKey = z.string().max(4096).optional();

const nodemailerInputSchema = z.object({
  provider: z.literal("nodemailer"),
  defaultFrom: requiredEmail("defaultFrom"),
  host: requiredString("host").max(253),
  port: z.coerce.number().int().min(1).max(65535),
  username: requiredString("username").max(320),
  password: z.string().max(4096).optional(),
});
const resendInputSchema = z.object({
  provider: z.literal("resend"),
  defaultFrom: optionalEmail,
  apiKey,
});
const sendgridInputSchema = z.object({
  provider: z.literal("sendgrid"),
  defaultFrom: requiredEmail("defaultFrom"),
  apiKey,
});
const mailchimpInputSchema = z.object({
  provider: z.literal("mailchimp"),
  defaultFrom: requiredEmail("defaultFrom"),
  apiKey,
});
const postalInputSchema = z.object({
  provider: z.literal("postal"),
  defaultFrom: requiredEmail("defaultFrom"),
  apiUrl: z.string().trim().url("apiUrl must be a valid URL"),
  serverApiKey: z.string().max(4096).optional(),
});

export const outboundSettingsInputSchema = z.discriminatedUnion("provider", [
  nodemailerInputSchema,
  resendInputSchema,
  sendgridInputSchema,
  mailchimpInputSchema,
  postalInputSchema,
]);

export type OutboundSettingsInput = z.infer<typeof outboundSettingsInputSchema>;
export type NodemailerConfig = { EMAIL_PROVIDER: "nodemailer"; DEFAULT_FROM: string; SMTP_HOST: string; SMTP_PORT: number; SMTP_USER: string; SMTP_PASS: string };
export type ResendConfig = { EMAIL_PROVIDER: "resend"; DEFAULT_FROM?: string; RESEND_API_KEY: string };
export type SendGridConfig = { EMAIL_PROVIDER: "sendgrid"; DEFAULT_FROM: string; SENDGRID_API_KEY: string };
export type MailchimpConfig = { EMAIL_PROVIDER: "mailchimp"; DEFAULT_FROM: string; MAILCHIMP_TRANSACTIONAL_API_KEY: string };
export type PostalConfig = { EMAIL_PROVIDER: "postal"; DEFAULT_FROM: string; POSTAL_API_URL: string; POSTAL_SERVER_API_KEY: string };
export type EmailProviderConfig = NodemailerConfig | ResendConfig | SendGridConfig | MailchimpConfig | PostalConfig;

type RetainedSecrets = { password?: string; apiKey?: string; serverApiKey?: string };

function requireSecret(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function buildEmailProviderConfig(raw: unknown, retained: RetainedSecrets = {}): EmailProviderConfig {
  const input = outboundSettingsInputSchema.parse(raw);
  switch (input.provider) {
    case "nodemailer":
      return { EMAIL_PROVIDER: input.provider, DEFAULT_FROM: input.defaultFrom, SMTP_HOST: input.host, SMTP_PORT: input.port, SMTP_USER: input.username, SMTP_PASS: requireSecret(input.password || retained.password, "password") };
    case "resend": {
      const key = requireSecret(input.apiKey || retained.apiKey, "apiKey");
      if (!key.startsWith("re_")) throw new Error("apiKey must start with re_");
      return { EMAIL_PROVIDER: input.provider, DEFAULT_FROM: input.defaultFrom, RESEND_API_KEY: key };
    }
    case "sendgrid": {
      const key = requireSecret(input.apiKey || retained.apiKey, "apiKey");
      if (!key.startsWith("SG.")) throw new Error("apiKey must start with SG.");
      return { EMAIL_PROVIDER: input.provider, DEFAULT_FROM: input.defaultFrom, SENDGRID_API_KEY: key };
    }
    case "mailchimp":
      return { EMAIL_PROVIDER: input.provider, DEFAULT_FROM: input.defaultFrom, MAILCHIMP_TRANSACTIONAL_API_KEY: requireSecret(input.apiKey || retained.apiKey, "apiKey") };
    case "postal":
      return { EMAIL_PROVIDER: input.provider, DEFAULT_FROM: input.defaultFrom, POSTAL_API_URL: input.apiUrl, POSTAL_SERVER_API_KEY: requireSecret(input.serverApiKey || retained.serverApiKey, "serverApiKey") };
  }
}

export function getDefaultFromAddress(config: EmailProviderConfig): string {
  return config.EMAIL_PROVIDER === "resend" ? config.DEFAULT_FROM || "onboarding@resend.dev" : config.DEFAULT_FROM;
}

export function getConfigSecrets(config: EmailProviderConfig): RetainedSecrets {
  switch (config.EMAIL_PROVIDER) {
    case "nodemailer": return { password: config.SMTP_PASS };
    case "resend": return { apiKey: config.RESEND_API_KEY };
    case "sendgrid": return { apiKey: config.SENDGRID_API_KEY };
    case "mailchimp": return { apiKey: config.MAILCHIMP_TRANSACTIONAL_API_KEY };
    case "postal": return { serverApiKey: config.POSTAL_SERVER_API_KEY };
  }
}
