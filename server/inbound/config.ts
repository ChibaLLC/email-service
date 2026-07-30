import { asc, eq, inArray, sql } from "drizzle-orm";
import { env } from "std-env";
import { ulid } from "ulid";
import { z } from "zod";
import { db, schema } from "../database";
import { decryptInboundValue, encryptInboundValue, parseEncryptionKey } from "./crypto";
import { normalizeSenderFilters } from "./filters";
import type { InboundAccountConfig, InboundAccountInput, InboundWebhook } from "./types";

export const INBOUND_CONFIG_LOCK_NAME = "email-service:inbound-config";

const mailboxInputSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  name: z.string().trim().min(1).max(100),
  path: z.string().trim().min(1).max(255),
  enabled: z.boolean(),
});

export const inboundAccountInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  enabled: z.boolean(),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(4096).optional(),
  mailboxes: z.array(mailboxInputSchema).min(1).max(100),
  pollIntervalSeconds: z.number().int().min(10).max(3600),
}).superRefine((value, context) => {
  if (new Set(value.mailboxes.map((mailbox) => mailbox.name.toLowerCase())).size !== value.mailboxes.length) {
    context.addIssue({ code: "custom", message: "Mailbox names must be unique" });
  }
  if (new Set(value.mailboxes.map((mailbox) => mailbox.path)).size !== value.mailboxes.length) {
    context.addIssue({ code: "custom", message: "Mailbox paths must be unique" });
  }
});

export const inboundWebhookInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  url: z.string().trim().url().max(2048).optional(),
  secret: z.string().min(32).max(4096).optional(),
  mailboxIds: z.array(z.string().min(1).max(128)).min(1).max(100).transform((ids) => [...new Set(ids)]),
  senderFilters: z.array(z.string().trim().min(1).max(320)).max(100).transform(normalizeSenderFilters),
});

function privateNetworksAllowed(): boolean {
  return env.INBOUND_WEBHOOK_ALLOW_PRIVATE_NETWORKS === "true";
}

function validateWebhookUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !privateNetworksAllowed()) throw new Error("Inbound webhook URL must use HTTPS");
  if (url.username || url.password) throw new Error("Inbound webhook URL must not contain credentials");
}

export function getInboundEncryptionKey(): Buffer {
  if (!env.INBOUND_CONFIG_ENCRYPTION_KEY) {
    throw new Error("INBOUND_CONFIG_ENCRYPTION_KEY is required for inbound email ingestion");
  }
  return parseEncryptionKey(env.INBOUND_CONFIG_ENCRYPTION_KEY);
}

export async function getInboundAccounts(): Promise<InboundAccountConfig[]> {
  const [accounts, mailboxes, webhooks, subscriptions] = await Promise.all([
    db.select().from(schema.inboundAccounts).where(eq(schema.inboundAccounts.enabled, true)).orderBy(asc(schema.inboundAccounts.createdAt)),
    db.select().from(schema.inboundMailboxes).where(eq(schema.inboundMailboxes.enabled, true)).orderBy(asc(schema.inboundMailboxes.createdAt)),
    db.select().from(schema.inboundWebhooks).orderBy(asc(schema.inboundWebhooks.createdAt)),
    db.select().from(schema.inboundWebhookSubscriptions),
  ]);
  if (!accounts.length) return [];
  const key = accounts.length ? getInboundEncryptionKey() : null;
  const mailboxIdsByWebhook = new Map<string, string[]>();
  for (const subscription of subscriptions) {
    const ids = mailboxIdsByWebhook.get(subscription.webhookId) || [];
    ids.push(subscription.mailboxId);
    mailboxIdsByWebhook.set(subscription.webhookId, ids);
  }
  const runtimeWebhooks: InboundWebhook[] = webhooks.map((webhook) => ({
    id: webhook.id,
    name: webhook.name,
    url: webhook.url,
    secret: decryptInboundValue(webhook.secretEncrypted, key!, "inbound-config:webhook-secret").toString(),
    ownerEmail: webhook.ownerEmail,
    senderFilters: webhook.senderFilters,
    mailboxIds: mailboxIdsByWebhook.get(webhook.id) || [],
  }));
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    source: "database",
    host: account.host,
    port: account.port,
    secure: account.secure,
    username: decryptInboundValue(account.usernameEncrypted, key!, "inbound-config:username").toString(),
    password: decryptInboundValue(account.passwordEncrypted, key!, "inbound-config:password").toString(),
    pollIntervalSeconds: account.pollIntervalSeconds,
    mailboxes: mailboxes.filter((mailbox) => mailbox.accountId === account.id).map((mailbox) => ({
      id: mailbox.id,
      name: mailbox.name,
      path: mailbox.path,
      webhooks: runtimeWebhooks.filter((webhook) => webhook.mailboxIds.includes(mailbox.id)),
    })),
  }));
}

export async function getInboundAccount(accountId: string): Promise<InboundAccountConfig | null> {
  const [account] = await db.select().from(schema.inboundAccounts).where(eq(schema.inboundAccounts.id, accountId)).limit(1);
  if (!account) return null;
  const mailboxes = await db.select().from(schema.inboundMailboxes).where(eq(schema.inboundMailboxes.accountId, account.id));
  const key = getInboundEncryptionKey();
  return {
    id: account.id,
    name: account.name,
    source: "database",
    host: account.host,
    port: account.port,
    secure: account.secure,
    username: decryptInboundValue(account.usernameEncrypted, key, "inbound-config:username").toString(),
    password: decryptInboundValue(account.passwordEncrypted, key, "inbound-config:password").toString(),
    pollIntervalSeconds: account.pollIntervalSeconds,
    mailboxes: mailboxes.map((mailbox) => ({ id: mailbox.id, name: mailbox.name, path: mailbox.path, webhooks: [] })),
  };
}

export async function getInboundConfigView(actor: { email: string; canModerate: boolean }) {
  const [accounts, mailboxes, webhooks, subscriptions] = await Promise.all([
    db.select().from(schema.inboundAccounts).orderBy(asc(schema.inboundAccounts.createdAt)),
    db.select().from(schema.inboundMailboxes).orderBy(asc(schema.inboundMailboxes.createdAt)),
    db.select().from(schema.inboundWebhooks).orderBy(asc(schema.inboundWebhooks.createdAt)),
    db.select().from(schema.inboundWebhookSubscriptions),
  ]);
  const mailboxIdsByWebhook = new Map<string, string[]>();
  for (const subscription of subscriptions) {
    const ids = mailboxIdsByWebhook.get(subscription.webhookId) || [];
    ids.push(subscription.mailboxId);
    mailboxIdsByWebhook.set(subscription.webhookId, ids);
  }
  const key = actor.canModerate && accounts.length ? getInboundEncryptionKey() : null;
  return {
    source: "database" as const,
    canManageAccounts: actor.canModerate,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      ...(actor.canModerate ? {
        enabled: account.enabled,
        host: account.host,
        port: account.port,
        secure: account.secure,
        username: decryptInboundValue(account.usernameEncrypted, key!, "inbound-config:username").toString(),
        hasPassword: Boolean(account.passwordEncrypted),
        pollIntervalSeconds: account.pollIntervalSeconds,
      } : {}),
      mailboxes: mailboxes.filter((mailbox) => mailbox.accountId === account.id && (actor.canModerate || mailbox.enabled)).map((mailbox) => ({
        id: mailbox.id,
        name: mailbox.name,
        ...(actor.canModerate ? { path: mailbox.path, enabled: mailbox.enabled } : {}),
      })),
    })),
    webhooks: webhooks.map((webhook) => {
      const owned = webhook.ownerEmail === actor.email;
      return {
        id: webhook.id,
        name: webhook.name,
        ownerEmail: webhook.ownerEmail,
        owned,
        canManage: owned || actor.canModerate,
        ...(owned ? { url: webhook.url } : {}),
        hasSecret: Boolean(webhook.secretEncrypted),
        senderFilters: webhook.senderFilters,
        mailboxIds: mailboxIdsByWebhook.get(webhook.id) || [],
      };
    }),
  };
}

export async function saveInboundAccount(id: string | undefined, input: InboundAccountInput) {
  const value = inboundAccountInputSchema.parse(input);
  const accountId = id || ulid();
  const key = getInboundEncryptionKey();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${INBOUND_CONFIG_LOCK_NAME}, 0))`);
    const [existing] = id ? await tx.select().from(schema.inboundAccounts).where(eq(schema.inboundAccounts.id, id)).limit(1).for("update") : [];
    if (id && !existing) throw new Error("Inbound account was not found");
    if (!value.password && !existing?.passwordEncrypted) throw new Error("Password is required for a new inbound account");
    const now = new Date();
    const accountValues = {
      name: value.name,
      enabled: value.enabled,
      host: value.host,
      port: value.port,
      secure: value.secure,
      usernameEncrypted: encryptInboundValue(value.username, key, "inbound-config:username"),
      passwordEncrypted: value.password ? encryptInboundValue(value.password, key, "inbound-config:password") : existing!.passwordEncrypted,
      pollIntervalSeconds: value.pollIntervalSeconds,
      updatedAt: now,
    };
    if (existing) await tx.update(schema.inboundAccounts).set(accountValues).where(eq(schema.inboundAccounts.id, accountId));
    else await tx.insert(schema.inboundAccounts).values({ id: accountId, ...accountValues });

    const existingMailboxes = await tx.select().from(schema.inboundMailboxes).where(eq(schema.inboundMailboxes.accountId, accountId));
    const retainedIds: string[] = [];
    for (const mailbox of value.mailboxes) {
      const existingMailbox = mailbox.id ? existingMailboxes.find((candidate) => candidate.id === mailbox.id) : undefined;
      if (mailbox.id && !existingMailbox) throw new Error("Mailbox does not belong to this account");
      const mailboxId = existingMailbox?.id || ulid();
      retainedIds.push(mailboxId);
      const mailboxValues = { name: mailbox.name, path: mailbox.path, enabled: mailbox.enabled, updatedAt: now };
      if (existingMailbox) await tx.update(schema.inboundMailboxes).set(mailboxValues).where(eq(schema.inboundMailboxes.id, mailboxId));
      else await tx.insert(schema.inboundMailboxes).values({ id: mailboxId, accountId, ...mailboxValues });
    }
    const removedIds = existingMailboxes.filter((mailbox) => !retainedIds.includes(mailbox.id)).map((mailbox) => mailbox.id);
    if (removedIds.length) await tx.delete(schema.inboundMailboxes).where(inArray(schema.inboundMailboxes.id, removedIds));
  });
  return { id: accountId };
}

export async function deleteInboundAccount(id: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${INBOUND_CONFIG_LOCK_NAME}, 0))`);
    const deleted = await tx.delete(schema.inboundAccounts).where(eq(schema.inboundAccounts.id, id)).returning({ id: schema.inboundAccounts.id });
    if (!deleted.length) throw new Error("Inbound account was not found");
  });
}

export async function createInboundWebhook(ownerEmail: string, input: z.infer<typeof inboundWebhookInputSchema>) {
  const value = inboundWebhookInputSchema.parse(input);
  if (!value.url) throw new Error("URL is required for a new webhook");
  if (!value.secret) throw new Error("Secret is required for a new webhook");
  validateWebhookUrl(value.url);
  const id = ulid();
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${INBOUND_CONFIG_LOCK_NAME}, 0))`);
    const mailboxes = await tx.select({ id: schema.inboundMailboxes.id }).from(schema.inboundMailboxes).where(inArray(schema.inboundMailboxes.id, value.mailboxIds));
    if (mailboxes.length !== value.mailboxIds.length) throw new Error("One or more subscribed mailboxes were not found");
    await tx.insert(schema.inboundWebhooks).values({
      id,
      name: value.name,
      url: value.url!,
      secretEncrypted: encryptInboundValue(value.secret!, getInboundEncryptionKey(), "inbound-config:webhook-secret"),
      ownerEmail,
      senderFilters: value.senderFilters,
    });
    await tx.insert(schema.inboundWebhookSubscriptions).values(value.mailboxIds.map((mailboxId) => ({ webhookId: id, mailboxId })));
  });
  return { id };
}

export async function updateInboundWebhook(id: string, input: z.infer<typeof inboundWebhookInputSchema>) {
  const value = inboundWebhookInputSchema.parse(input);
  if (value.url) validateWebhookUrl(value.url);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${INBOUND_CONFIG_LOCK_NAME}, 0))`);
    const mailboxes = await tx.select({ id: schema.inboundMailboxes.id }).from(schema.inboundMailboxes).where(inArray(schema.inboundMailboxes.id, value.mailboxIds));
    if (mailboxes.length !== value.mailboxIds.length) throw new Error("One or more subscribed mailboxes were not found");
    const values = {
      name: value.name,
      ...(value.url ? { url: value.url } : {}),
      ...(value.secret ? { secretEncrypted: encryptInboundValue(value.secret, getInboundEncryptionKey(), "inbound-config:webhook-secret") } : {}),
      senderFilters: value.senderFilters,
      updatedAt: new Date(),
    };
    const updated = await tx.update(schema.inboundWebhooks).set(values).where(eq(schema.inboundWebhooks.id, id)).returning({ id: schema.inboundWebhooks.id });
    if (!updated.length) throw new Error("Webhook was not found");
    await tx.delete(schema.inboundWebhookSubscriptions).where(eq(schema.inboundWebhookSubscriptions.webhookId, id));
    await tx.insert(schema.inboundWebhookSubscriptions).values(value.mailboxIds.map((mailboxId) => ({ webhookId: id, mailboxId })));
  });
}

export async function getInboundWebhook(id: string) {
  const [webhook] = await db.select().from(schema.inboundWebhooks).where(eq(schema.inboundWebhooks.id, id)).limit(1);
  return webhook;
}

export async function deleteInboundWebhook(id: string) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${INBOUND_CONFIG_LOCK_NAME}, 0))`);
    const deleted = await tx.delete(schema.inboundWebhooks).where(eq(schema.inboundWebhooks.id, id)).returning({ id: schema.inboundWebhooks.id });
    if (!deleted.length) throw new Error("Webhook was not found");
  });
}
