import { createHash } from "node:crypto";
import type { H3Event } from "h3";
import { eq } from "drizzle-orm";
import { db, schema } from "../database";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function useAuth(event: H3Event, throwError?: true): Promise<string>;
export async function useAuth(event: H3Event, throwError: false): Promise<[string, undefined] | [undefined, string]>;
export async function useAuth(event: H3Event, throwError: boolean = true) {
  const token = readAuthToken(event);
  if (!token) {
    if (throwError) {
      throw createError({ status: 401, message: "Missing API key" });
    }
    return [undefined, "Missing API key"];
  }

  const keyHash = hashApiKey(token);
  const [apiKey] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, keyHash)).limit(1);

  if (!apiKey || !apiKey.active) {
    if (throwError) {
      throw createError({ status: 401, message: "Invalid or revoked API key" });
    }
    return [undefined, "Invalid or revoked API key"];
  }

  // Update last used timestamp (fire-and-forget)
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKey.id))
    .catch(() => {});

  if (!throwError) {
    return [apiKey.email, undefined];
  }
  return apiKey.email;
}

export function readAuthToken(event: H3Event): string | null {
  let auth = getHeader(event, "Authorization") || null;
  if (!auth) auth = getCookie(event, "Authorization") || null;
  if (!auth) return null;

  const [bearer, token] = auth.split(" ");
  if (bearer?.toLowerCase() !== "bearer") return null;
  if (!token || token.trim().length === 0) return null;

  return token;
}
