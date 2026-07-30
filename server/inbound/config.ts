import { eq, sql } from "drizzle-orm";
import { env } from "std-env";
import { ulid } from "ulid";
import { z } from "zod";
import { db, schema } from "../database";
import { decryptInboundValue, encryptInboundValue, parseEncryptionKey } from "./crypto";
import { normalizeSenderFilters } from "./filters";
import type { InboundConfig, InboundConfigInput, InboundWebhook } from "./types";

const CONFIG_ID = "primary";
const CONFIG_LOCK_NAME = "email-service:inbound-config:primary";
const inboundWebhookInputSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2048),
  secret: z.string().min(32).max(4096).optional(),
  senderFilters: z.array(z.string().trim().min(1).max(320)).max(100),
});

export const inboundConfigInputSchema = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(320),
  password: z.string().max(4096).optional(),
  mailbox: z.string().trim().min(1).max(255),
  webhooks: z.array(inboundWebhookInputSchema).max(10),
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
  webhooks: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(100),
        url: z.string().trim().url().max(2048),
        secret: z.string().min(32).max(4096),
        senderFilters: z.array(z.string().trim().min(1).max(320)).max(100),
      }),
    )
    .min(1)
    .max(10),
  pollIntervalSeconds: z.number().int().min(10).max(3600),
});

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected true or false, received ${value}`);
}

function validateWebhookUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !readBoolean(env.INBOUND_WEBHOOK_ALLOW_PRIVATE_NETWORKS, false)) {
    throw new Error("Inbound webhook URL must use HTTPS");
  }
}

export function getInboundEncryptionKey(): Buffer {
  if (!env.INBOUND_CONFIG_ENCRYPTION_KEY) {
    throw new Error("INBOUND_CONFIG_ENCRYPTION_KEY is required for inbound email ingestion");
  }
  return parseEncryptionKey(env.INBOUND_CONFIG_ENCRYPTION_KEY);
}

export function validateInboundConfig(input: Omit<InboundConfig, "source">): Omit<InboundConfig, "source"> {
  const config = configSchema.parse(input);
  for (const webhook of config.webhooks) validateWebhookUrl(webhook.url);
  return {
    ...config,
    webhooks: config.webhooks.map((webhook) => ({
      ...webhook,
      senderFilters: normalizeSenderFilters(webhook.senderFilters),
    })),
  };
}

async function readInboundConfigRows() {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${CONFIG_LOCK_NAME}, 0))`);
    const [row] = await tx.select().from(schema.inboundConfig).where(eq(schema.inboundConfig.id, CONFIG_ID)).limit(1);
    const webhooks = await tx.select().from(schema.inboundWebhooks).orderBy(schema.inboundWebhooks.createdAt);
    return { row, webhooks };
  });
}

export async function getInboundConfig(): Promise<InboundConfig | null> {
  const { row, webhooks: rows } = await readInboundConfigRows();
  if (!row?.enabled) return null;
  if (!row.host || !row.usernameEncrypted || !row.passwordEncrypted)
    throw new Error("Inbound email configuration is incomplete");

  const key = getInboundEncryptionKey();
  const webhooks: InboundWebhook[] = rows.map((webhook) => ({
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    secret: decryptInboundValue(webhook.secretEncrypted, key, "inbound-config:webhook-secret").toString(),
    senderFilters: webhook.senderFilters,
  }));
  return {
    ...validateInboundConfig({
      enabled: true,
      host: row.host,
      port: row.port,
      secure: row.secure,
      username: decryptInboundValue(row.usernameEncrypted, key, "inbound-config:username").toString(),
      password: decryptInboundValue(row.passwordEncrypted, key, "inbound-config:password").toString(),
      mailbox: row.mailbox,
      webhooks,
      pollIntervalSeconds: row.pollIntervalSeconds,
    }),
    source: "database",
  };
}

export async function getInboundConfigView() {
  const { row, webhooks } = await readInboundConfigRows();
  const key = row?.usernameEncrypted ? getInboundEncryptionKey() : null;
  return {
    source: "database" as const,
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
    webhooks: webhooks.map((webhook) => ({
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      hasSecret: Boolean(webhook.secretEncrypted),
      senderFilters: webhook.senderFilters,
    })),
    pollIntervalSeconds: row?.pollIntervalSeconds || 30,
  };
}

export async function saveInboundConfig(input: InboundConfigInput) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${CONFIG_LOCK_NAME}, 0))`);
    const [existing] = await tx
      .select()
      .from(schema.inboundConfig)
      .where(eq(schema.inboundConfig.id, CONFIG_ID))
      .limit(1)
      .for("update");
    const existingWebhooks = await tx.select().from(schema.inboundWebhooks).orderBy(schema.inboundWebhooks.createdAt);
    const existingById = new Map(existingWebhooks.map((webhook) => [webhook.id, webhook]));
    const key = getInboundEncryptionKey();
    const password = input.password || (existing?.passwordEncrypted ? "preserved" : "");
    const webhooks = input.webhooks.map((webhook) => {
      const existingWebhook = webhook.id ? existingById.get(webhook.id) : undefined;
      return {
        ...webhook,
        id: webhook.id || ulid(),
        secret:
          webhook.secret ||
          (existingWebhook?.secretEncrypted
            ? decryptInboundValue(existingWebhook.secretEncrypted, key, "inbound-config:webhook-secret").toString()
            : ""),
        senderFilters: normalizeSenderFilters(webhook.senderFilters),
      };
    });
    if (input.enabled) validateInboundConfig({ ...input, enabled: true, password, webhooks });

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
      pollIntervalSeconds: input.pollIntervalSeconds,
      updatedAt: now,
    };
    await tx
      .insert(schema.inboundConfig)
      .values({ id: CONFIG_ID, ...values })
      .onConflictDoUpdate({ target: schema.inboundConfig.id, set: values });
    const webhookIds = webhooks.map((webhook) => webhook.id);
    await Promise.all(
      webhooks.map((webhook) =>
        tx
          .insert(schema.inboundWebhooks)
          .values({
            id: webhook.id,
            name: webhook.name.trim(),
            url: webhook.url.trim(),
            secretEncrypted: webhook.secret
              ? encryptInboundValue(webhook.secret, key, "inbound-config:webhook-secret")
              : "",
            senderFilters: webhook.senderFilters,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: schema.inboundWebhooks.id,
            set: {
              name: webhook.name.trim(),
              url: webhook.url.trim(),
              secretEncrypted: webhook.secret
                ? encryptInboundValue(webhook.secret, key, "inbound-config:webhook-secret")
                : "",
              senderFilters: webhook.senderFilters,
              updatedAt: now,
            },
          }),
      ),
    );
    const deletedIds = existingWebhooks
      .filter((webhook) => !webhookIds.includes(webhook.id))
      .map((webhook) => webhook.id);
    for (const id of deletedIds) await tx.delete(schema.inboundWebhooks).where(eq(schema.inboundWebhooks.id, id));
  });
}
