import { env } from "std-env";
import { z } from "zod";

const providerNames = ["nodemailer", "resend", "sendgrid", "mailchimp", "postal"] as const;

const providerNameSchema = z.enum(providerNames, {
  errorMap: () => ({
    message: `EMAIL_PROVIDER must be one of: ${providerNames.join(", ")}`,
  }),
});

function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function requiredString(name: string) {
  return z.preprocess(
    emptyStringToUndefined,
    z.string({ required_error: `${name} is required` }).trim().min(1, `${name} is required`),
  );
}

function requiredEmail(name: string) {
  return z.preprocess(
    emptyStringToUndefined,
    z.string({ required_error: `${name} is required` }).trim().email(`${name} must be a valid email address`),
  );
}

function optionalEmail() {
  return z.preprocess(emptyStringToUndefined, z.string().trim().email("DEFAULT_FROM must be a valid email address").optional());
}

const smtpPortSchema = z.preprocess(
  (value) => {
    const normalized = emptyStringToUndefined(value);
    if (typeof normalized === "undefined") return undefined;
    if (typeof normalized === "number") return normalized;
    if (typeof normalized === "string") return Number(normalized);
    return normalized;
  },
  z
    .number({
      required_error: "SMTP_PORT is required",
      invalid_type_error: "SMTP_PORT must be a valid port number",
    })
    .int("SMTP_PORT must be a whole number")
    .min(1, "SMTP_PORT must be between 1 and 65535")
    .max(65535, "SMTP_PORT must be between 1 and 65535"),
);

const nodemailerSchema = z.object({
  DEFAULT_FROM: requiredEmail("DEFAULT_FROM"),
  SMTP_HOST: requiredString("SMTP_HOST"),
  SMTP_PORT: smtpPortSchema,
  SMTP_USER: requiredString("SMTP_USER"),
  SMTP_PASS: requiredString("SMTP_PASS"),
});

const resendSchema = z.object({
  DEFAULT_FROM: optionalEmail(),
  RESEND_API_KEY: requiredString("RESEND_API_KEY").refine((value) => value.startsWith("re_"), {
    message: "RESEND_API_KEY must start with re_",
  }),
});

const sendgridSchema = z.object({
  DEFAULT_FROM: requiredEmail("DEFAULT_FROM"),
  SENDGRID_API_KEY: requiredString("SENDGRID_API_KEY").refine((value) => value.startsWith("SG."), {
    message: "SENDGRID_API_KEY must start with SG.",
  }),
});

const mailchimpSchema = z.object({
  DEFAULT_FROM: requiredEmail("DEFAULT_FROM"),
  MAILCHIMP_TRANSACTIONAL_API_KEY: requiredString("MAILCHIMP_TRANSACTIONAL_API_KEY"),
});

const postalSchema = z.object({
  DEFAULT_FROM: requiredEmail("DEFAULT_FROM"),
  POSTAL_API_URL: requiredString("POSTAL_API_URL").refine((value) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, {
    message: "POSTAL_API_URL must be a valid URL",
  }),
  POSTAL_SERVER_API_KEY: requiredString("POSTAL_SERVER_API_KEY"),
});

const providerSchemas = {
  nodemailer: nodemailerSchema,
  resend: resendSchema,
  sendgrid: sendgridSchema,
  mailchimp: mailchimpSchema,
  postal: postalSchema,
} as const;

export type EmailProviderName = (typeof providerNames)[number];
export type NodemailerConfig = z.infer<typeof nodemailerSchema> & { EMAIL_PROVIDER: "nodemailer" };
export type ResendConfig = z.infer<typeof resendSchema> & { EMAIL_PROVIDER: "resend" };
export type SendGridConfig = z.infer<typeof sendgridSchema> & { EMAIL_PROVIDER: "sendgrid" };
export type MailchimpConfig = z.infer<typeof mailchimpSchema> & { EMAIL_PROVIDER: "mailchimp" };
export type PostalConfig = z.infer<typeof postalSchema> & { EMAIL_PROVIDER: "postal" };
export type EmailProviderConfig = NodemailerConfig | ResendConfig | SendGridConfig | MailchimpConfig | PostalConfig;

type RawEmailProviderEnv = Record<string, string | undefined> & {
  EMAIL_PROVIDER?: string;
  DEFAULT_FROM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASS?: string;
  RESEND_API_KEY?: string;
  SENDGRID_API_KEY?: string;
  MAILCHIMP_TRANSACTIONAL_API_KEY?: string;
  POSTAL_API_URL?: string;
  POSTAL_SERVER_API_KEY?: string;
};

function readEmailProviderEnv(raw: RawEmailProviderEnv = env as RawEmailProviderEnv): RawEmailProviderEnv {
  return {
    EMAIL_PROVIDER: raw.EMAIL_PROVIDER || "nodemailer",
    DEFAULT_FROM: raw.DEFAULT_FROM,
    SMTP_HOST: raw.SMTP_HOST,
    SMTP_PORT: raw.SMTP_PORT,
    SMTP_USER: raw.SMTP_USER,
    SMTP_PASS: raw.SMTP_PASS,
    RESEND_API_KEY: raw.RESEND_API_KEY,
    SENDGRID_API_KEY: raw.SENDGRID_API_KEY,
    MAILCHIMP_TRANSACTIONAL_API_KEY: raw.MAILCHIMP_TRANSACTIONAL_API_KEY,
    POSTAL_API_URL: raw.POSTAL_API_URL,
    POSTAL_SERVER_API_KEY: raw.POSTAL_SERVER_API_KEY,
  };
}

function formatConfigError(providerName: EmailProviderName, error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join(".") || "config";
    return `- ${path}: ${issue.message}`;
  });

  return [
    `Invalid email configuration for provider \"${providerName}\".`,
    ...issues,
    "Update your environment variables before starting the server.",
  ].join("\n");
}

export function getSelectedEmailProviderName(raw: RawEmailProviderEnv = env as RawEmailProviderEnv): EmailProviderName {
  const env = readEmailProviderEnv(raw);
  const result = providerNameSchema.safeParse(env.EMAIL_PROVIDER);

  if (!result.success) {
    throw new Error(`Invalid email configuration. ${result.error.issues[0]?.message || "Unsupported EMAIL_PROVIDER."}`);
  }

  return result.data;
}

export function parseEmailProviderConfig<T extends EmailProviderName>(
  providerName: T,
  raw: RawEmailProviderEnv = env as RawEmailProviderEnv,
) {
  const env = readEmailProviderEnv(raw);
  const result = providerSchemas[providerName].safeParse(env);

  if (!result.success) {
    throw new Error(formatConfigError(providerName, result.error));
  }

  return {
    EMAIL_PROVIDER: providerName,
    ...result.data,
  } as Extract<EmailProviderConfig, { EMAIL_PROVIDER: T }>;
}

export function validateSelectedEmailProviderConfig(
  raw: RawEmailProviderEnv = env as RawEmailProviderEnv,
): EmailProviderConfig {
  const providerName = getSelectedEmailProviderName(raw);
  return parseEmailProviderConfig(providerName, raw);
}

export function getDefaultFromAddress(config: EmailProviderConfig = validateSelectedEmailProviderConfig()): string {
  if (config.EMAIL_PROVIDER === "resend") {
    return config.DEFAULT_FROM || "onboarding@resend.dev";
  }

  return config.DEFAULT_FROM;
}