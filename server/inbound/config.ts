import { eq } from "drizzle-orm";
import { env } from "std-env";
import { z } from "zod";
import { db, schema } from "../database";
import { decryptInboundValue, encryptInboundValue, parseEncryptionKey } from "./crypto";
import type { InboundConfig, InboundConfigInput, InboundConfigSource } from "./types";

const CONFIG_ID = "primary";
export const inboundConfigInputSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(320),
  password: z.string().max(4096).optional(),
  mailbox: z.string().trim().min(1).max(255),
  webhookUrl: z.string().trim().max(2048),
  webhookSecret: z.string().max(4096).optional(),
  pollIntervalSeconds: z.number().int().min(10).max(3600),
});
const configSchema = z.object({
  enabled: z.literal(true),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(4096),
  mailbox: z.string().trim().min(1).max(255),
  webhookUrl: z.string().url().max(2048),
  webhookSecret: z.string().min(32).max(4096),
  pollIntervalSeconds: z.number().int().min(10).max(3600),
});

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected true or false, received ${value}`);
}

function readInteger(value: string | undefined, fallback: number): number {
  return value ? Number(value) : fallback;
}

export function getInboundConfigSource(): InboundConfigSource {
  const source = env.INBOUND_CONFIG_SOURCE || "environment";
  if (source !== "environment" && source !== "database") {
    throw new Error("INBOUND_CONFIG_SOURCE must be environment or database");
  }
  return source;
}

export function getInboundEncryptionKey(): Buffer {
  if (!env.INBOUND_CONFIG_ENCRYPTION_KEY) {
    throw new Error("INBOUND_CONFIG_ENCRYPTION_KEY is required for inbound email ingestion");
  }
  return parseEncryptionKey(env.INBOUND_CONFIG_ENCRYPTION_KEY);
}

export function validateInboundConfig(input: Omit<InboundConfig, "source">): Omit<InboundConfig, "source"> {
  const config = configSchema.parse(input);
  const url = new URL(config.webhookUrl);
  const privateNetworksAllowed = readBoolean(env.INBOUND_WEBHOOK_ALLOW_PRIVATE_NETWORKS, false);
  if (url.protocol !== "https:" && !privateNetworksAllowed) {
    throw new Error("Inbound webhook URL must use HTTPS");
  }
  return config;
}

async function readDatabaseConfig(): Promise<InboundConfig | null> {
  const [row] = await db.select().from(schema.inboundConfig).where(eq(schema.inboundConfig.id, CONFIG_ID)).limit(1);
  if (!row?.enabled) return null;
  if (!row.host || !row.usernameEncrypted || !row.passwordEncrypted || !row.webhookUrl || !row.webhookSecretEncrypted) {
    throw new Error("Database inbound email configuration is incomplete");
  }

  const key = getInboundEncryptionKey();
  return {
    ...validateInboundConfig({
      enabled: true,
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: decryptInboundValue(row.usernameEncrypted, key, "inbound-config:username").toString(),
      password: decryptInboundValue(row.passwordEncrypted, key, "inbound-config:password").toString(),
      mailbox: row.mailbox,
      webhookUrl: row.webhookUrl,
      webhookSecret: decryptInboundValue(row.webhookSecretEncrypted, key, "inbound-config:webhook-secret").toString(),
      pollIntervalSeconds: row.pollIntervalSeconds,
    }),
    source: "database",
  };
}

function readEnvironmentConfig(): InboundConfig | null {
  if (!readBoolean(env.INBOUND_IMAP_ENABLED, false)) return null;
  getInboundEncryptionKey();
  return {
    ...validateInboundConfig({
      enabled: true,
      host: env.INBOUND_IMAP_HOST || "",
      port: readInteger(env.INBOUND_IMAP_PORT, 993),
      secure: readBoolean(env.INBOUND_IMAP_SECURE, true),
      username: env.INBOUND_IMAP_USERNAME || "",
      password: env.INBOUND_IMAP_PASSWORD || "",
      mailbox: env.INBOUND_IMAP_MAILBOX || "INBOX",
      webhookUrl: env.INBOUND_WEBHOOK_URL || "",
      webhookSecret: env.INBOUND_WEBHOOK_SECRET || "",
      pollIntervalSeconds: readInteger(env.INBOUND_IMAP_POLL_INTERVAL_SECONDS, 30),
    }),
    source: "environment",
  };
}

export async function getInboundConfig(): Promise<InboundConfig | null> {
  return getInboundConfigSource() === "database" ? readDatabaseConfig() : readEnvironmentConfig();
}

export async function getInboundConfigView() {
  const source = getInboundConfigSource();
  if (source === "environment") {
    const config = readEnvironmentConfig();
    return {
      source,
      editable: false,
      enabled: Boolean(config),
      host: config?.host || "",
      port: config?.port || 993,
      secure: config?.secure ?? true,
      username: config?.username || "",
      hasPassword: Boolean(config?.password),
      mailbox: config?.mailbox || "INBOX",
      webhookUrl: config?.webhookUrl || "",
      hasWebhookSecret: Boolean(config?.webhookSecret),
      pollIntervalSeconds: config?.pollIntervalSeconds || 30,
    };
  }

  const [row] = await db.select().from(schema.inboundConfig).where(eq(schema.inboundConfig.id, CONFIG_ID)).limit(1);
  const key = row?.usernameEncrypted ? getInboundEncryptionKey() : null;
  return {
    source,
    editable: true,
    enabled: row?.enabled ?? false,
    host: row?.host || "",
    port: row?.port || 993,
    secure: row?.secure ?? true,
    username:
      row?.usernameEncrypted && key
        ? decryptInboundValue(row.usernameEncrypted, key, "inbound-config:username").toString()
        : "",
    hasPassword: Boolean(row?.passwordEncrypted),
    mailbox: row?.mailbox || "INBOX",
    webhookUrl: row?.webhookUrl || "",
    hasWebhookSecret: Boolean(row?.webhookSecretEncrypted),
    pollIntervalSeconds: row?.pollIntervalSeconds || 30,
  };
}

export async function saveInboundConfig(input: InboundConfigInput) {
  if (getInboundConfigSource() !== "database") {
    throw new Error("Set INBOUND_CONFIG_SOURCE=database to edit inbound settings in the dashboard");
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.inboundConfig)
      .where(eq(schema.inboundConfig.id, CONFIG_ID))
      .limit(1)
      .for("update");
    const password = input.password || (existing?.passwordEncrypted ? "preserved" : "");
    const webhookSecret = input.webhookSecret || (existing?.webhookSecretEncrypted ? "x".repeat(32) : "");
    if (input.enabled) {
      validateInboundConfig({ ...input, enabled: true, password, webhookSecret });
    }

    const key = getInboundEncryptionKey();
    const now = new Date();
    const values = {
      enabled: input.enabled,
      host: input.host.trim() || null,
      port: input.port,
      secure: input.secure,
      usernameEncrypted: input.username
        ? encryptInboundValue(input.username.trim(), key, "inbound-config:username")
        : null,
      passwordEncrypted: input.password
        ? encryptInboundValue(input.password, key, "inbound-config:password")
        : existing?.passwordEncrypted || null,
      mailbox: input.mailbox.trim() || "INBOX",
      webhookUrl: input.webhookUrl.trim() || null,
      webhookSecretEncrypted: input.webhookSecret
        ? encryptInboundValue(input.webhookSecret, key, "inbound-config:webhook-secret")
        : existing?.webhookSecretEncrypted || null,
      pollIntervalSeconds: input.pollIntervalSeconds,
      updatedAt: now,
    };
    await tx
      .insert(schema.inboundConfig)
      .values({ id: CONFIG_ID, ...values })
      .onConflictDoUpdate({
        target: schema.inboundConfig.id,
        set: values,
      });
  });
}
