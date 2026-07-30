import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { ImapFlow } from "imapflow";
import { and, asc, count, countDistinct, eq, isNotNull, isNull, lt, lte, notExists } from "drizzle-orm";
import { consola } from "consola";
import { ulid } from "ulid";
import { db, pool, schema } from "../database";
import { getInboundAccount, getInboundAccounts, getInboundEncryptionKey, INBOUND_CONFIG_LOCK_NAME } from "./config";
import { createWebhookSignature, decryptInboundValue, encryptInboundValue } from "./crypto";
import { assertSafeWebhookDestination } from "./network";
import { matchesSenderFilters } from "./filters";
import type { InboundAccountConfig, InboundMailboxConfig, InboundWebhookPayload } from "./types";
import { buildInboundWebhookPreview } from "./webhook-preview";
import { parseCalendarReply } from "./calendar-reply";

const ADVISORY_LOCK_NAME = "email-service:inbound";
const MAX_RAW_SIZE = 1_000_000;
const FETCH_BATCH_SIZE = 25;
const MAX_PENDING_MESSAGES = 250;
const RAW_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const METADATA_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const logger = consola.withTag("inbound-email");

function accountFingerprint(config: InboundAccountConfig, mailboxPath: string): string {
  return createHash("sha256")
    .update([config.host.toLowerCase(), config.port, config.username, mailboxPath].join("\0"))
    .digest("hex");
}

function createClient(config: InboundAccountConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    doSTARTTLS: config.secure ? undefined : true,
    auth: { user: config.username, pass: config.password },
    disableAutoIdle: true,
    logger: false,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    maxLiteralSize: MAX_RAW_SIZE + 1,
    tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
  });
}

export async function verifyInboundConnection(accountId: string) {
  const config = await getInboundAccount(accountId);
  if (!config) throw new Error("Inbound account was not found");
  const client = createClient(config);
  try {
    await client.connect();
    const mailboxes: { id: string; path: string; messages: number; uidNext: number }[] = [];
    for (const configured of config.mailboxes) {
      const mailbox = await client.mailboxOpen(configured.path, { readOnly: true });
      mailboxes.push({ id: configured.id, path: mailbox.path, messages: mailbox.exists, uidNext: mailbox.uidNext });
    }
    return { accountId: config.id, mailboxes };
  } finally {
    if (client.usable) await client.logout().catch(() => client.close());
  }
}

async function recordOversizedMessage(
  config: InboundAccountConfig,
  mailbox: InboundMailboxConfig,
  fingerprint: string,
  uidValidity: string,
  message: {
    uid: number;
    size?: number;
    envelope?: { messageId?: string; from?: { address?: string }[]; to?: { address?: string }[] };
    internalDate?: Date | string;
  },
) {
  const webhooks = mailbox.webhooks.filter((webhook) =>
    matchesSenderFilters(message.envelope?.from?.[0]?.address, webhook.senderFilters),
  );
  if (webhooks.length === 0) return;
  const messageId = ulid();
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(schema.inboundMessages)
      .values({
        id: messageId,
        accountFingerprint: fingerprint,
        accountId: config.id,
        accountName: config.name,
        mailboxId: mailbox.id,
        mailboxName: mailbox.name,
        mailbox: mailbox.path,
        uidValidity,
        uid: message.uid,
        messageId: message.envelope?.messageId,
        from: message.envelope?.from?.[0]?.address,
        to: message.envelope?.to?.[0]?.address,
        rawEncrypted: null,
        rawSize: message.size || MAX_RAW_SIZE + 1,
        receivedAt: message.internalDate ? new Date(message.internalDate) : null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.inboundMessages.id });
    if (!inserted) return;
    await tx.insert(schema.inboundWebhookDeliveries).values(
      webhooks.map((webhook) => ({
        messageId,
        webhookId: webhook.id,
        webhookName: webhook.name,
        webhookUrl: webhook.url,
        webhookSecretEncrypted: encryptInboundValue(
          webhook.secret,
          getInboundEncryptionKey(),
          "inbound-config:webhook-secret",
        ),
        status: "failed" as const,
        attempts: 0,
        lastError: `Message exceeds ${MAX_RAW_SIZE} byte inbound limit`,
      })),
    );
  });
}

async function ingestMailbox(config: InboundAccountConfig, configuredMailbox: InboundMailboxConfig) {
  const [pending] = await db
    .select({ count: countDistinct(schema.inboundWebhookDeliveries.messageId) })
    .from(schema.inboundWebhookDeliveries)
    .where(eq(schema.inboundWebhookDeliveries.status, "pending"));
  const availableCapacity = MAX_PENDING_MESSAGES - Number(pending?.count || 0);
  if (availableCapacity <= 0) {
    throw new Error(`Inbound webhook backlog reached the ${MAX_PENDING_MESSAGES} message safety limit`);
  }

  const fingerprint = accountFingerprint(config, configuredMailbox.path);
  const client = createClient(config);
  await db.insert(schema.inboundRuntimeState).values({ id: configuredMailbox.id }).onConflictDoNothing();

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(configuredMailbox.path, { readOnly: true });
    const uidValidity = mailbox.uidValidity.toString();
    const [state] = await db
      .select()
      .from(schema.inboundRuntimeState)
      .where(eq(schema.inboundRuntimeState.id, configuredMailbox.id))
      .limit(1);
    if (!state) throw new Error("Could not initialize inbound mailbox cursor");
    const sourceChanged = state?.accountFingerprint !== fingerprint || state?.uidValidity !== uidValidity;
    if (sourceChanged) {
      await db
        .update(schema.inboundRuntimeState)
        .set({
          accountFingerprint: fingerprint,
          uidValidity,
          lastUid: Math.max(0, mailbox.uidNext - 1),
          lastPollAt: new Date(),
          lastSuccessAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.inboundRuntimeState.id, configuredMailbox.id));
      logger.info(`Initialized mailbox cursor for ${config.name}/${configuredMailbox.name} at current high-water mark`);
      return;
    }

    const firstUid = state.lastUid + 1;
    const finalUid = Math.min(mailbox.uidNext - 1, firstUid + Math.min(FETCH_BATCH_SIZE, availableCapacity) - 1);
    if (finalUid < firstUid) {
      await db
        .update(schema.inboundRuntimeState)
        .set({ lastPollAt: new Date(), lastSuccessAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(schema.inboundRuntimeState.id, configuredMailbox.id));
      return;
    }

    let lastUid = state.lastUid;
    for await (const message of client.fetch(
      `${firstUid}:${finalUid}`,
      { uid: true, source: { maxLength: MAX_RAW_SIZE + 1 }, size: true, envelope: true, internalDate: true },
      { uid: true },
    )) {
      if (message.uid < firstUid || message.uid > finalUid) continue;
      const rawSize = message.size || message.source?.length || 0;
      if (!message.source || rawSize > MAX_RAW_SIZE || message.source.length > MAX_RAW_SIZE) {
        await recordOversizedMessage(config, configuredMailbox, fingerprint, uidValidity, message);
        lastUid = Math.max(lastUid, message.uid);
        continue;
      }

      const sender = message.envelope?.from?.[0]?.address;
      const webhooks = configuredMailbox.webhooks.filter((webhook) => matchesSenderFilters(sender, webhook.senderFilters));
      if (webhooks.length === 0) {
        lastUid = Math.max(lastUid, message.uid);
        continue;
      }

      const inboundMessageId = ulid();
      const key = getInboundEncryptionKey();
      await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(schema.inboundMessages)
          .values({
            id: inboundMessageId,
            accountFingerprint: fingerprint,
            accountId: config.id,
            accountName: config.name,
            mailboxId: configuredMailbox.id,
            mailboxName: configuredMailbox.name,
            mailbox: configuredMailbox.path,
            uidValidity,
            uid: message.uid,
            messageId: message.envelope?.messageId,
            from: message.envelope?.from?.[0]?.address,
            to: message.envelope?.to?.[0]?.address,
            rawEncrypted: encryptInboundValue(message.source!, key, `inbound-message:${inboundMessageId}`),
            rawSize,
            receivedAt: message.internalDate ? new Date(message.internalDate) : null,
          })
          .onConflictDoNothing()
          .returning({ id: schema.inboundMessages.id });
        if (inserted) {
          await tx.insert(schema.inboundWebhookDeliveries).values(
            webhooks.map((webhook) => ({
              messageId: inboundMessageId,
              webhookId: webhook.id,
              webhookName: webhook.name,
              webhookUrl: webhook.url,
              webhookSecretEncrypted: encryptInboundValue(webhook.secret, key, "inbound-config:webhook-secret"),
            })),
          );
        }
      });
      lastUid = Math.max(lastUid, message.uid);
    }
    lastUid = finalUid;

    await db
      .update(schema.inboundRuntimeState)
      .set({ lastUid, lastPollAt: new Date(), lastSuccessAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(schema.inboundRuntimeState.id, configuredMailbox.id));
  } finally {
    if (client.usable) await client.logout().catch(() => client.close());
  }
}

function retryDelay(attempts: number): number {
  const delays = [60, 300, 1_800, 7_200, 21_600];
  return delays[Math.min(attempts - 1, delays.length - 1)]! * 1_000;
}

async function postWebhook(
  destination: Awaited<ReturnType<typeof assertSafeWebhookDestination>>,
  headers: Record<string, string>,
  body: string,
) {
  const url = destination.url;
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return new Promise<number>((resolve, reject) => {
    const outgoing = request(
      {
        protocol: url.protocol,
        hostname: destination.address || url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        servername:
          destination.address && destination.address !== destination.hostname ? destination.hostname : undefined,
        headers: { ...headers, host: url.host },
      },
      (response) => {
        response.on("error", reject);
        response.destroy();
        resolve(response.statusCode || 0);
      },
    );
    outgoing.setTimeout(15_000, () => outgoing.destroy(new Error("Webhook request timed out")));
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

export async function verifyInboundWebhook(
  webhook: { name: string; url: string; secretEncrypted: string },
  previewOnly = false,
) {
  const secret = decryptInboundValue(
    webhook.secretEncrypted,
    getInboundEncryptionKey(),
    "inbound-config:webhook-secret",
  ).toString();
  const preview = buildInboundWebhookPreview(webhook, secret);
  if (!previewOnly) {
    try {
      preview.status = await postWebhook(
        await assertSafeWebhookDestination(webhook.url),
        preview.headers,
        preview.body,
      );
    } catch {
      preview.status = null;
    }
  }
  return preview;
}

async function deliverPending() {
  const rows = await db
    .select({ delivery: schema.inboundWebhookDeliveries, message: schema.inboundMessages })
    .from(schema.inboundWebhookDeliveries)
    .innerJoin(schema.inboundMessages, eq(schema.inboundWebhookDeliveries.messageId, schema.inboundMessages.id))
    .where(
      and(
        eq(schema.inboundWebhookDeliveries.status, "pending"),
        lte(schema.inboundWebhookDeliveries.nextAttemptAt, new Date()),
      ),
    )
    .orderBy(asc(schema.inboundWebhookDeliveries.nextAttemptAt))
    .limit(25);

  for (const { delivery, message } of rows) {
    const attempts = delivery.attempts + 1;
    let responseStatus: number | null = null;
    try {
      if (!message.rawEncrypted) throw new Error("Encrypted message body is unavailable");
      const raw = decryptInboundValue(message.rawEncrypted, getInboundEncryptionKey(), `inbound-message:${message.id}`);
      const payload: InboundWebhookPayload = {
        type: "email.received",
        version: 1,
        id: message.id,
        occurredAt: message.createdAt.toISOString(),
        email: {
          from: message.from,
          to: message.to,
          messageId: message.messageId,
          mailbox: message.mailbox,
          accountId: message.accountId,
          accountName: message.accountName,
          mailboxId: message.mailboxId,
          mailboxName: message.mailboxName,
          uidValidity: message.uidValidity,
          uid: message.uid,
          rawMimeBase64: raw.toString("base64"),
          rawSize: message.rawSize,
          receivedAt: message.receivedAt?.toISOString() || null,
          calendarReply: parseCalendarReply(raw),
        },
      };
      const body = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1_000).toString();
      if (!delivery.webhookUrl || !delivery.webhookSecretEncrypted)
        throw new Error("Webhook destination is unavailable");
      const destination = await assertSafeWebhookDestination(delivery.webhookUrl);
      const webhookSecret = decryptInboundValue(
        delivery.webhookSecretEncrypted,
        getInboundEncryptionKey(),
        "inbound-config:webhook-secret",
      ).toString();
      responseStatus = await postWebhook(
        destination,
        {
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
          "idempotency-key": message.id,
          "x-email-service-event": "email.received",
          "x-email-service-timestamp": timestamp,
          "x-email-service-signature": createWebhookSignature(webhookSecret, timestamp, body),
        },
        body,
      );
      if (responseStatus < 200 || responseStatus >= 300) {
        throw new Error(`Webhook returned HTTP ${responseStatus}`);
      }

      await db.transaction(async (tx) => {
        await tx
          .update(schema.inboundWebhookDeliveries)
          .set({
            status: "delivered",
            attempts,
            responseStatus,
            lastError: null,
            deliveredAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.inboundWebhookDeliveries.id, delivery.id));
        const [pending] = await tx
          .select({ count: count() })
          .from(schema.inboundWebhookDeliveries)
          .where(
            and(
              eq(schema.inboundWebhookDeliveries.messageId, message.id),
              eq(schema.inboundWebhookDeliveries.status, "pending"),
            ),
          );
        if (Number(pending?.count || 0) === 0) {
          await tx
            .update(schema.inboundMessages)
            .set({ rawEncrypted: null })
            .where(eq(schema.inboundMessages.id, message.id));
        }
      });
    } catch (error) {
      await db
        .update(schema.inboundWebhookDeliveries)
        .set({
          status: "pending",
          attempts,
          responseStatus,
          lastError: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown webhook delivery error",
          nextAttemptAt: new Date(Date.now() + retryDelay(attempts)),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.inboundWebhookDeliveries.id, delivery.id),
            eq(schema.inboundWebhookDeliveries.status, "pending"),
          ),
        );
      logger.warn(`Webhook delivery ${delivery.id} failed on attempt ${attempts}`);
    }
  }
}

async function cleanupInboundHistory() {
  const expired = await db
    .select({ deliveryId: schema.inboundWebhookDeliveries.id, messageId: schema.inboundMessages.id })
    .from(schema.inboundWebhookDeliveries)
    .innerJoin(schema.inboundMessages, eq(schema.inboundWebhookDeliveries.messageId, schema.inboundMessages.id))
    .where(
      and(
        eq(schema.inboundWebhookDeliveries.status, "pending"),
        lt(schema.inboundWebhookDeliveries.createdAt, new Date(Date.now() - RAW_RETENTION_MS)),
      ),
    )
    .limit(100);
  for (const row of expired) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.inboundWebhookDeliveries)
        .set({
          status: "failed",
          lastError: "Webhook delivery exceeded the seven-day encrypted MIME retention period",
          updatedAt: new Date(),
        })
        .where(eq(schema.inboundWebhookDeliveries.id, row.deliveryId));
      const [pending] = await tx
        .select({ count: count() })
        .from(schema.inboundWebhookDeliveries)
        .where(
          and(
            eq(schema.inboundWebhookDeliveries.messageId, row.messageId),
            eq(schema.inboundWebhookDeliveries.status, "pending"),
          ),
        );
      if (Number(pending?.count || 0) === 0) {
        await tx
          .update(schema.inboundMessages)
          .set({ rawEncrypted: null })
          .where(eq(schema.inboundMessages.id, row.messageId));
      }
    });
  }

  await db
    .update(schema.inboundMessages)
    .set({ rawEncrypted: null })
    .where(
      and(
        isNotNull(schema.inboundMessages.rawEncrypted),
        notExists(
          db
            .select({ id: schema.inboundWebhookDeliveries.id })
            .from(schema.inboundWebhookDeliveries)
            .where(
              and(
                eq(schema.inboundWebhookDeliveries.messageId, schema.inboundMessages.id),
                eq(schema.inboundWebhookDeliveries.status, "pending"),
              ),
            ),
        ),
      ),
    );

  await db
    .delete(schema.inboundMessages)
    .where(
      and(
        isNull(schema.inboundMessages.rawEncrypted),
        lt(schema.inboundMessages.createdAt, new Date(Date.now() - METADATA_RETENTION_MS)),
      ),
    );
}

async function updateRuntimeError(mailboxId: string, error: unknown) {
  await db.insert(schema.inboundRuntimeState).values({ id: mailboxId }).onConflictDoNothing();
  await db
    .update(schema.inboundRuntimeState)
    .set({
      lastPollAt: new Date(),
      lastError: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown inbound email error",
      updatedAt: new Date(),
    })
    .where(eq(schema.inboundRuntimeState.id, mailboxId));
}

export async function runInboundCycle(): Promise<number> {
  let accounts: InboundAccountConfig[] = [];
  let interval = 30;

  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [ADVISORY_LOCK_NAME],
    );
    if (!lock.rows[0]?.acquired) return interval;

    try {
      await lockClient.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [INBOUND_CONFIG_LOCK_NAME]);
      try {
        accounts = await getInboundAccounts();
        interval = accounts.length ? Math.min(...accounts.map((account) => account.pollIntervalSeconds)) : 30;
      } catch (error) {
        logger.error("Invalid inbound email configuration", error);
        const mailboxes = await db.select({ id: schema.inboundMailboxes.id }).from(schema.inboundMailboxes);
        for (const mailbox of mailboxes) await updateRuntimeError(mailbox.id, error);
      }
      await cleanupInboundHistory();
      await deliverPending();
      const states = await db.select().from(schema.inboundRuntimeState);
      const lastPollByMailbox = new Map(states.map((state) => [state.id, state.lastPollAt]));
      for (const account of accounts) {
        for (const mailbox of account.mailboxes) {
          const lastPollAt = lastPollByMailbox.get(mailbox.id);
          if (lastPollAt && Date.now() - lastPollAt.getTime() < account.pollIntervalSeconds * 1_000) continue;
          try {
            await ingestMailbox(account, mailbox);
          } catch (error) {
            logger.error(`Inbound poll failed for ${account.name}/${mailbox.name}`, error);
            await updateRuntimeError(mailbox.id, error);
          }
        }
      }
      await deliverPending();
    } catch (error) {
      logger.error("Inbound email cycle failed", error);
    } finally {
      await lockClient.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [INBOUND_CONFIG_LOCK_NAME]);
      await lockClient.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [ADVISORY_LOCK_NAME]);
    }
  } finally {
    lockClient.release();
  }
  return interval;
}

export async function getInboundRuntimeStatus() {
  const states = await db
    .select({
      state: schema.inboundRuntimeState,
      mailboxId: schema.inboundMailboxes.id,
      mailboxName: schema.inboundMailboxes.name,
      accountId: schema.inboundAccounts.id,
      accountName: schema.inboundAccounts.name,
    })
    .from(schema.inboundRuntimeState)
    .innerJoin(schema.inboundMailboxes, eq(schema.inboundRuntimeState.id, schema.inboundMailboxes.id))
    .innerJoin(schema.inboundAccounts, eq(schema.inboundMailboxes.accountId, schema.inboundAccounts.id));
  const deliveryCounts = await db
    .select({ status: schema.inboundWebhookDeliveries.status, count: count() })
    .from(schema.inboundWebhookDeliveries)
    .groupBy(schema.inboundWebhookDeliveries.status);
  const counts = Object.fromEntries(deliveryCounts.map((row) => [row.status, Number(row.count)]));
  return {
    mailboxes: states.map(({ state, mailboxId, mailboxName, accountId, accountName }) => ({
      accountId,
      accountName,
      mailboxId,
      mailboxName,
      uidValidity: state.uidValidity || null,
      lastUid: state.lastUid || 0,
      lastPollAt: state.lastPollAt?.toISOString() || null,
      lastSuccessAt: state.lastSuccessAt?.toISOString() || null,
      lastError: state.lastError || null,
    })),
    pendingDeliveries: counts.pending || 0,
    failedDeliveries: counts.failed || 0,
  };
}
