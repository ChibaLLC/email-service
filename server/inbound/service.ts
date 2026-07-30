import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { ImapFlow } from "imapflow";
import { and, asc, count, eq, isNull, lt, lte } from "drizzle-orm";
import { consola } from "consola";
import { ulid } from "ulid";
import { db, pool, schema } from "../database";
import { getInboundConfig, getInboundEncryptionKey } from "./config";
import { createWebhookSignature, decryptInboundValue, encryptInboundValue } from "./crypto";
import { assertSafeWebhookDestination } from "./network";
import { matchesSenderFilters } from "./filters";
import type { InboundConfig, InboundWebhookPayload } from "./types";

const STATE_ID = "primary";
const ADVISORY_LOCK_NAME = "email-service:inbound:primary";
const MAX_RAW_SIZE = 1_000_000;
const FETCH_BATCH_SIZE = 25;
const MAX_PENDING_MESSAGES = 250;
const RAW_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;
const METADATA_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const logger = consola.withTag("inbound-email");

function accountFingerprint(config: InboundConfig): string {
  return createHash("sha256")
    .update([config.host.toLowerCase(), config.port, config.username, config.mailbox].join("\0"))
    .digest("hex");
}

function createClient(config: InboundConfig): ImapFlow {
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

export async function verifyInboundConnection(input?: InboundConfig | null) {
  const config = input ?? (await getInboundConfig());
  if (!config) throw new Error("Inbound email ingestion is disabled");
  const client = createClient(config);
  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(config.mailbox, { readOnly: true });
    return { mailbox: mailbox.path, messages: mailbox.exists, uidNext: mailbox.uidNext };
  } finally {
    if (client.usable) await client.logout().catch(() => client.close());
  }
}

async function recordOversizedMessage(
  config: InboundConfig,
  fingerprint: string,
  uidValidity: string,
  message: {
    uid: number;
    size?: number;
    envelope?: { messageId?: string; from?: { address?: string }[]; to?: { address?: string }[] };
    internalDate?: Date | string;
  },
) {
  const webhooks = config.webhooks.filter((webhook) => matchesSenderFilters(message.envelope?.from?.[0]?.address, webhook.senderFilters));
  if (webhooks.length === 0) return;
  const messageId = ulid();
  await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(schema.inboundMessages)
      .values({
        id: messageId,
        accountFingerprint: fingerprint,
        mailbox: config.mailbox,
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
        webhookSecretEncrypted: encryptInboundValue(webhook.secret, getInboundEncryptionKey(), "inbound-config:webhook-secret"),
        status: "failed" as const,
        attempts: 0,
        lastError: `Message exceeds ${MAX_RAW_SIZE} byte inbound limit`,
      })),
    );
  });
}

async function ingestMailbox(config: InboundConfig) {
  const [pending] = await db
    .select({ count: count() })
    .from(schema.inboundWebhookDeliveries)
    .where(eq(schema.inboundWebhookDeliveries.status, "pending"));
  const availableCapacity = Math.floor((MAX_PENDING_MESSAGES - Number(pending?.count || 0)) / config.webhooks.length);
  if (availableCapacity <= 0) {
    throw new Error(`Inbound webhook backlog reached the ${MAX_PENDING_MESSAGES} message safety limit`);
  }

  const fingerprint = accountFingerprint(config);
  const client = createClient(config);
  await db.insert(schema.inboundRuntimeState).values({ id: STATE_ID }).onConflictDoNothing();

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(config.mailbox, { readOnly: true });
    const uidValidity = mailbox.uidValidity.toString();
    const [state] = await db
      .select()
      .from(schema.inboundRuntimeState)
      .where(eq(schema.inboundRuntimeState.id, STATE_ID))
      .limit(1);
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
        .where(eq(schema.inboundRuntimeState.id, STATE_ID));
      logger.info("Initialized mailbox cursor at current high-water mark");
      return;
    }

    const firstUid = state.lastUid + 1;
    const finalUid = Math.min(
      mailbox.uidNext - 1,
      firstUid + Math.min(FETCH_BATCH_SIZE, availableCapacity) - 1,
    );
    if (finalUid < firstUid) {
      await db
        .update(schema.inboundRuntimeState)
        .set({ lastPollAt: new Date(), lastSuccessAt: new Date(), lastError: null, updatedAt: new Date() })
        .where(eq(schema.inboundRuntimeState.id, STATE_ID));
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
        await recordOversizedMessage(config, fingerprint, uidValidity, message);
        lastUid = Math.max(lastUid, message.uid);
        continue;
      }

      const sender = message.envelope?.from?.[0]?.address;
      const webhooks = config.webhooks.filter((webhook) => matchesSenderFilters(sender, webhook.senderFilters));
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
            mailbox: config.mailbox,
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
      .where(eq(schema.inboundRuntimeState.id, STATE_ID));
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
        response.resume();
        resolve(response.statusCode || 0);
      },
    );
    outgoing.setTimeout(15_000, () => outgoing.destroy(new Error("Webhook request timed out")));
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

export async function verifyInboundWebhook(webhookId: string) {
  const config = await getInboundConfig();
  if (!config) throw new Error("Inbound email ingestion is disabled");
  const webhook = config.webhooks.find((candidate) => candidate.id === webhookId);
  if (!webhook) throw new Error("Webhook destination was not found");
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const body = JSON.stringify({ type: "email.received.test", version: 1, webhook: webhook.name, occurredAt: new Date().toISOString() });
  const status = await postWebhook(await assertSafeWebhookDestination(webhook.url), {
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
    "x-email-service-event": "email.received.test",
    "x-email-service-timestamp": timestamp,
    "x-email-service-signature": createWebhookSignature(webhook.secret, timestamp, body),
  }, body);
  if (status < 200 || status >= 300) throw new Error(`Webhook returned HTTP ${status}`);
  return { status };
}

async function clearDeliveredMessage(messageId: string) {
  const [pending] = await db
    .select({ count: count() })
    .from(schema.inboundWebhookDeliveries)
    .where(and(eq(schema.inboundWebhookDeliveries.messageId, messageId), eq(schema.inboundWebhookDeliveries.status, "pending")));
  if (Number(pending?.count || 0) === 0) {
    await db.update(schema.inboundMessages).set({ rawEncrypted: null }).where(eq(schema.inboundMessages.id, messageId));
  }
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
          uidValidity: message.uidValidity,
          uid: message.uid,
          rawMimeBase64: raw.toString("base64"),
          rawSize: message.rawSize,
          receivedAt: message.receivedAt?.toISOString() || null,
        },
      };
      const body = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1_000).toString();
      if (!delivery.webhookUrl || !delivery.webhookSecretEncrypted) throw new Error("Webhook destination is unavailable");
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
      });
      await clearDeliveredMessage(message.id);
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
      });
      await clearDeliveredMessage(row.messageId);
  }

  await db
    .delete(schema.inboundMessages)
    .where(
      and(
        isNull(schema.inboundMessages.rawEncrypted),
        lt(schema.inboundMessages.createdAt, new Date(Date.now() - METADATA_RETENTION_MS)),
      ),
    );
}

async function updateRuntimeError(error: unknown) {
  await db.insert(schema.inboundRuntimeState).values({ id: STATE_ID }).onConflictDoNothing();
  await db
    .update(schema.inboundRuntimeState)
    .set({
      lastPollAt: new Date(),
      lastError: error instanceof Error ? error.message.slice(0, 2_000) : "Unknown inbound email error",
      updatedAt: new Date(),
    })
    .where(eq(schema.inboundRuntimeState.id, STATE_ID));
}

export async function runInboundCycle(): Promise<number> {
  let config: InboundConfig | null = null;
  let configError: unknown;
  try {
    config = await getInboundConfig();
  } catch (error) {
    logger.error("Invalid inbound email configuration", error);
    configError = error;
  }

  const lockClient = await pool.connect();
  try {
    const lock = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [ADVISORY_LOCK_NAME],
    );
    if (!lock.rows[0]?.acquired) return config?.pollIntervalSeconds || 30;

    try {
      await cleanupInboundHistory();
      if (configError) {
        await updateRuntimeError(configError);
        return 30;
      }
      if (!config) return 30;
      await deliverPending();
      await ingestMailbox(config);
      await deliverPending();
    } catch (error) {
      logger.error("Inbound email cycle failed", error);
      await updateRuntimeError(error);
    } finally {
      await lockClient.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [ADVISORY_LOCK_NAME]);
    }
  } finally {
    lockClient.release();
  }
  return config?.pollIntervalSeconds || 30;
}

export async function getInboundRuntimeStatus() {
  const [state] = await db
    .select()
    .from(schema.inboundRuntimeState)
    .where(eq(schema.inboundRuntimeState.id, STATE_ID))
    .limit(1);
  const deliveryCounts = await db
    .select({ status: schema.inboundWebhookDeliveries.status, count: count() })
    .from(schema.inboundWebhookDeliveries)
    .groupBy(schema.inboundWebhookDeliveries.status);
  const counts = Object.fromEntries(deliveryCounts.map((row) => [row.status, Number(row.count)]));
  return {
    uidValidity: state?.uidValidity || null,
    lastUid: state?.lastUid || 0,
    lastPollAt: state?.lastPollAt?.toISOString() || null,
    lastSuccessAt: state?.lastSuccessAt?.toISOString() || null,
    lastError: state?.lastError || null,
    pendingDeliveries: counts.pending || 0,
    failedDeliveries: counts.failed || 0,
  };
}
