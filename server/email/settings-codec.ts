import { decryptSetting, encryptSetting } from "../settings/crypto";
import { buildEmailProviderConfig, type EmailProviderConfig } from "./config";

type StoredProviderSettings = {
  id: string;
  provider: string;
  config: Record<string, unknown>;
  secretsEncrypted: Record<string, string>;
};

export function serializeProviderConfig(config: EmailProviderConfig): { config: Record<string, unknown>; secrets: Record<string, string> } {
  switch (config.EMAIL_PROVIDER) {
    case "nodemailer": return { config: { defaultFrom: config.DEFAULT_FROM, host: config.SMTP_HOST, port: config.SMTP_PORT, username: config.SMTP_USER }, secrets: { password: config.SMTP_PASS } };
    case "resend": return { config: { defaultFrom: config.DEFAULT_FROM }, secrets: { apiKey: config.RESEND_API_KEY } };
    case "sendgrid": return { config: { defaultFrom: config.DEFAULT_FROM }, secrets: { apiKey: config.SENDGRID_API_KEY } };
    case "mailchimp": return { config: { defaultFrom: config.DEFAULT_FROM }, secrets: { apiKey: config.MAILCHIMP_TRANSACTIONAL_API_KEY } };
    case "postal": return { config: { defaultFrom: config.DEFAULT_FROM, apiUrl: config.POSTAL_API_URL }, secrets: { serverApiKey: config.POSTAL_SERVER_API_KEY } };
  }
}

export function encryptProviderSecrets(secrets: Record<string, string>, key: Buffer, settingsId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([field, value]) => [field, encryptSetting(value, key, `outbound:${settingsId}`, field)]));
}

export function decryptProviderSecrets(secrets: Record<string, string>, key: Buffer, settingsId: string): Record<string, string> {
  return Object.fromEntries(Object.entries(secrets).map(([field, value]) => [field, decryptSetting(value, key, `outbound:${settingsId}`, field)]));
}

export function hydrateProviderConfig(row: StoredProviderSettings, key: Buffer): EmailProviderConfig {
  const secrets = decryptProviderSecrets(row.secretsEncrypted, key, row.id);
  return buildEmailProviderConfig({ provider: row.provider, ...row.config, ...secrets });
}
