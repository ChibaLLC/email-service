import { env } from "std-env";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "../database";
import { decryptSetting, encryptSetting, parseSettingsEncryptionKey } from "../settings/crypto";

const listmonkProxySchema = z.object({
  LISTMONK_API_URL: z.string({ required_error: "LISTMONK_API_URL is required" }).trim().url("LISTMONK_API_URL must be a valid URL"),
  LISTMONK_USERNAME: z.string({ required_error: "LISTMONK_USERNAME is required" }).trim().min(1, "LISTMONK_USERNAME is required"),
  LISTMONK_PASSWORD: z.string({ required_error: "LISTMONK_PASSWORD is required" }).min(1, "LISTMONK_PASSWORD is required"),
});

type RawListmonkEnv = Record<string, string | undefined> & {
  LISTMONK_API_URL?: string;
  LISTMONK_USERNAME?: string;
  LISTMONK_PASSWORD?: string;
};

export type ListmonkProxyConfig = z.infer<typeof listmonkProxySchema>;

export const listmonkSettingsInputSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string().trim().max(2048).refine((value) => {
    if (!value) return true;
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "Base URL must be a valid HTTP or HTTPS URL"),
  username: z.string().trim().max(320),
  password: z.string().max(4096).optional(),
});

function assertAllowedSettingsUrl(value: string) {
  if (!value) return;
  const url = new URL(value);
  if (url.username || url.password) throw new Error("Listmonk URL must not contain credentials");
  if (url.protocol !== "https:" && env.SETTINGS_ALLOW_PRIVATE_NETWORKS !== "true") {
    throw new Error("Listmonk URL must use HTTPS unless SETTINGS_ALLOW_PRIVATE_NETWORKS=true");
  }
}

function readListmonkEnv(raw: RawListmonkEnv = env as RawListmonkEnv): RawListmonkEnv {
  return {
    LISTMONK_API_URL: raw.LISTMONK_API_URL,
    LISTMONK_USERNAME: raw.LISTMONK_USERNAME,
    LISTMONK_PASSWORD: raw.LISTMONK_PASSWORD,
  };
}

export function getListmonkProxyConfig(raw: RawListmonkEnv = env as RawListmonkEnv): ListmonkProxyConfig {
  const result = listmonkProxySchema.safeParse(readListmonkEnv(raw));

  if (!result.success) {
    const issues = result.error.issues.map((issue) => `- ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(["Invalid Listmonk proxy configuration.", ...issues].join("\n"));
  }

  return result.data;
}

export function getListmonkApiBaseUrl(config: ListmonkProxyConfig = getListmonkProxyConfig()): string {
  const trimmed = config.LISTMONK_API_URL.replace(/\/+$/, "");
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

export function getListmonkBasicAuthHeader(config: ListmonkProxyConfig = getListmonkProxyConfig()): string {
  return `Basic ${Buffer.from(`${config.LISTMONK_USERNAME}:${config.LISTMONK_PASSWORD}`).toString("base64")}`;
}

function isTableUnavailable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: string }).code === "42P01") return true;
  return "cause" in error && isTableUnavailable((error as { cause?: unknown }).cause);
}

function getSettingsKey(): Buffer {
  if (!env.SETTINGS_ENCRYPTION_KEY) throw new Error("SETTINGS_ENCRYPTION_KEY is required to store Listmonk credentials");
  return parseSettingsEncryptionKey(env.SETTINGS_ENCRYPTION_KEY);
}

export async function getListmonkSettingsView() {
  try {
    const [row] = await db.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.integration, "listmonk")).limit(1);
    if (row) return {
      source: "database" as const,
      enabled: row.enabled,
      baseUrl: row.baseUrl || "",
      username: row.username || "",
      hasPassword: Boolean(row.passwordEncrypted),
    };
  } catch (error) {
    if (!isTableUnavailable(error)) throw error;
  }

  const fallback = readListmonkEnv();
  return {
    source: "environment" as const,
    enabled: Boolean(fallback.LISTMONK_API_URL && fallback.LISTMONK_USERNAME && fallback.LISTMONK_PASSWORD),
    baseUrl: fallback.LISTMONK_API_URL || "",
    username: fallback.LISTMONK_USERNAME || "",
    hasPassword: Boolean(fallback.LISTMONK_PASSWORD),
  };
}

export async function getEffectiveListmonkProxyConfig(): Promise<ListmonkProxyConfig> {
  try {
    const [row] = await db.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.integration, "listmonk")).limit(1);
    if (!row) return getListmonkProxyConfig();
    if (!row.enabled) throw createError({ statusCode: 503, message: "Listmonk integration is disabled" });
    return listmonkProxySchema.parse({
      LISTMONK_API_URL: row.baseUrl,
      LISTMONK_USERNAME: row.username,
      LISTMONK_PASSWORD: row.passwordEncrypted ? decryptSetting(row.passwordEncrypted, getSettingsKey(), "listmonk", "password") : undefined,
    });
  } catch (error) {
    if (isTableUnavailable(error)) return getListmonkProxyConfig();
    throw error;
  }
}

export async function saveListmonkSettings(actorEmail: string, input: z.infer<typeof listmonkSettingsInputSchema>) {
  const value = listmonkSettingsInputSchema.parse(input);
  assertAllowedSettingsUrl(value.baseUrl);
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(schema.integrationSettings).where(eq(schema.integrationSettings.integration, "listmonk")).limit(1).for("update");
    const passwordEncrypted = value.password
      ? encryptSetting(value.password, getSettingsKey(), "listmonk", "password")
      : existing?.passwordEncrypted || null;
    if (value.enabled && (!value.baseUrl || !value.username || !passwordEncrypted)) {
      throw new Error("Base URL, username, and password are required when Listmonk is enabled");
    }
    const now = new Date();
    await tx.insert(schema.integrationSettings).values({
      integration: "listmonk",
      enabled: value.enabled,
      baseUrl: value.baseUrl || null,
      username: value.username || null,
      passwordEncrypted,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: schema.integrationSettings.integration,
      set: { enabled: value.enabled, baseUrl: value.baseUrl || null, username: value.username || null, passwordEncrypted, updatedAt: now },
    });
    await tx.insert(schema.settingsAuditEvents).values({
      actorEmail,
      action: "update",
      target: "listmonk",
      details: { enabled: value.enabled, baseUrl: value.baseUrl, username: value.username, passwordChanged: Boolean(value.password) },
    });
  });
}
