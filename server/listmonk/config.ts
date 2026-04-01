import { env } from "std-env";
import { z } from "zod";

const listmonkProxySchema = z.object({
  LISTMONK_API_URL: z.string({ required_error: "LISTMONK_API_URL is required" }).trim().url("LISTMONK_API_URL must be a valid URL"),
  LISTMONK_USERNAME: z.string({ required_error: "LISTMONK_USERNAME is required" }).trim().min(1, "LISTMONK_USERNAME is required"),
  LISTMONK_PASSWORD: z.string({ required_error: "LISTMONK_PASSWORD is required" }).trim().min(1, "LISTMONK_PASSWORD is required"),
});

type RawListmonkEnv = Record<string, string | undefined> & {
  LISTMONK_API_URL?: string;
  LISTMONK_USERNAME?: string;
  LISTMONK_PASSWORD?: string;
};

export type ListmonkProxyConfig = z.infer<typeof listmonkProxySchema>;

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