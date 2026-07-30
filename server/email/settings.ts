import { desc, eq, sql } from "drizzle-orm";
import { env } from "std-env";
import { ulid } from "ulid";
import type { OutboundSettingsView } from "../../shared/types";
import { db, schema } from "../database";
import { parseSettingsEncryptionKey } from "../settings/crypto";
import {
  buildEmailProviderConfig,
  getConfigSecrets,
  outboundSettingsInputSchema,
  type EmailProviderConfig,
  type EmailProviderName,
  type OutboundSettingsInput,
} from "./config";
import { createEmailProvider } from "./providers";
import { encryptProviderSecrets, hydrateProviderConfig, serializeProviderConfig } from "./settings-codec";

type OutboundRow = typeof schema.outboundSettings.$inferSelect;
const providerCache = new Map<string, { config: EmailProviderConfig; provider: ReturnType<typeof createEmailProvider> }>();

function getSettingsKey(): Buffer {
  if (!env.SETTINGS_ENCRYPTION_KEY) throw new Error("SETTINGS_ENCRYPTION_KEY is required for outbound provider settings");
  return parseSettingsEncryptionKey(env.SETTINGS_ENCRYPTION_KEY);
}

function toView(row?: OutboundRow): OutboundSettingsView {
  if (!row) return { source: "database", configured: false, active: null };
  const base = { id: row.id, version: row.version, provider: row.provider as EmailProviderName, createdAt: row.createdAt.toISOString(), createdBy: row.createdBy };
  switch (row.provider) {
    case "nodemailer": return { source: "database", configured: true, active: { ...base, config: { defaultFrom: String(row.config.defaultFrom), host: String(row.config.host), port: Number(row.config.port), username: String(row.config.username), hasPassword: Boolean(row.secretsEncrypted.password) } } };
    case "postal": return { source: "database", configured: true, active: { ...base, config: { defaultFrom: String(row.config.defaultFrom), apiUrl: String(row.config.apiUrl), hasServerApiKey: Boolean(row.secretsEncrypted.serverApiKey) } } };
    default: return { source: "database", configured: true, active: { ...base, config: { defaultFrom: typeof row.config.defaultFrom === "string" ? row.config.defaultFrom : undefined, hasApiKey: Boolean(row.secretsEncrypted.apiKey) } } };
  }
}

export async function getOutboundSettingsView(): Promise<OutboundSettingsView> {
  const [row] = await db.select().from(schema.outboundSettings).where(eq(schema.outboundSettings.active, true)).limit(1);
  return toView(row);
}

export async function getActiveOutboundSettings(): Promise<{ id: string; version: number; config: EmailProviderConfig }> {
  const [row] = await db.select().from(schema.outboundSettings).where(eq(schema.outboundSettings.active, true)).limit(1);
  if (!row) throw createError({ statusCode: 503, message: "Outbound email is not configured. Configure a provider in dashboard settings." });
  return { id: row.id, version: row.version, config: hydrateProviderConfig(row, getSettingsKey()) };
}

export async function getEmailProviderForSettings(settingsId?: string | null) {
  let row: OutboundRow | undefined;
  if (settingsId) {
    [row] = await db.select().from(schema.outboundSettings).where(eq(schema.outboundSettings.id, settingsId)).limit(1);
    if (!row) throw new Error(`Outbound settings ${settingsId} no longer exist`);
  } else {
    [row] = await db.select().from(schema.outboundSettings).where(eq(schema.outboundSettings.active, true)).limit(1);
    if (!row) throw createError({ statusCode: 503, message: "Outbound email is not configured. Configure a provider in dashboard settings." });
  }
  const cached = providerCache.get(row.id);
  if (cached) return { settingsId: row.id, ...cached };
  const config = hydrateProviderConfig(row, getSettingsKey());
  const resolved = { config, provider: createEmailProvider(config) };
  providerCache.set(row.id, resolved);
  return { settingsId: row.id, ...resolved };
}

export async function saveOutboundSettings(actorEmail: string, raw: OutboundSettingsInput): Promise<OutboundSettingsView> {
  const input = outboundSettingsInputSchema.parse(raw);
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('outbound_settings_write'))`);
    const [current] = await tx.select().from(schema.outboundSettings).where(eq(schema.outboundSettings.active, true)).limit(1);
    const retained = current?.provider === input.provider ? getConfigSecrets(hydrateProviderConfig(current, getSettingsKey())) : {};
    const providerConfig = buildEmailProviderConfig(input, retained);
    const id = ulid();
    const serialized = serializeProviderConfig(providerConfig);
    const [latest] = await tx.select({ version: schema.outboundSettings.version }).from(schema.outboundSettings).orderBy(desc(schema.outboundSettings.version)).limit(1);
    if (current) await tx.update(schema.outboundSettings).set({ active: false }).where(eq(schema.outboundSettings.id, current.id));
    const version = (latest?.version || 0) + 1;
    await tx.insert(schema.outboundSettings).values({
      id,
      version,
      provider: providerConfig.EMAIL_PROVIDER,
      config: serialized.config,
      secretsEncrypted: encryptProviderSecrets(serialized.secrets, getSettingsKey(), id),
      active: true,
      createdBy: actorEmail,
    });
    await tx.insert(schema.settingsAuditEvents).values({
      actorEmail,
      action: "save_activate",
      target: "outbound_settings",
      details: { settingsId: id, version, provider: providerConfig.EMAIL_PROVIDER, secretChanged: ["password", "apiKey", "serverApiKey"].some((field) => Boolean((input as unknown as Record<string, unknown>)[field])) },
    });
  });
  return getOutboundSettingsView();
}

export async function testActiveOutboundSettings(actorEmail: string) {
  const active = await getActiveOutboundSettings();
  const provider = createEmailProvider(active.config);
  if (!provider.verify) throw new Error(`Connection testing is not supported for ${provider.name}`);
  const success = await provider.verify();
  if (!success) throw new Error(`Could not verify the ${provider.name} connection`);
  await db.insert(schema.settingsAuditEvents).values({
    actorEmail,
    action: "connection_test",
    target: "outbound_settings",
    details: { settingsId: active.id, version: active.version, provider: provider.name, success: true },
  });
  return { success: true as const, provider: provider.name as EmailProviderName, settingsId: active.id, version: active.version };
}
