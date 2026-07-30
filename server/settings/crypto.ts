import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

export function parseSettingsEncryptionKey(encoded: string): Buffer {
  const normalized = encoded.trim();
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== normalized.replace(/=+$/, "")) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return key;
}

export function encryptSetting(value: string, key: Buffer, integration: string, field: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`${integration}:${field}`));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSetting(value: string, key: Buffer, integration: string, field: string): string {
  const [version, iv, tag, encrypted, ...rest] = value.split(".");
  if (version !== VERSION || !iv || !tag || !encrypted || rest.length) throw new Error("Unsupported encrypted setting");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from(`${integration}:${field}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
