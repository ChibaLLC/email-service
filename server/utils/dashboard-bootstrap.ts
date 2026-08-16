import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "std-env";
import { getRedisConnection } from "../queue/connection";
import { parseSettingsEncryptionKey } from "../settings/crypto";

const BOOTSTRAP_NONCE_KEY = "dashboard:bootstrap:nonce";
const BOOTSTRAP_TTL_SECONDS = 60 * 60;

function digest(code: string): Buffer {
  return createHash("sha256").update(code).digest();
}

export function deriveDashboardBootstrapCode(nonce: string, encryptionKey: string): string {
  return createHmac("sha256", parseSettingsEncryptionKey(encryptionKey)).update(nonce).digest("base64url");
}

function getEncryptionKey(): string {
  if (!env.SETTINGS_ENCRYPTION_KEY) throw new Error("SETTINGS_ENCRYPTION_KEY is required for dashboard setup");
  return env.SETTINGS_ENCRYPTION_KEY;
}

export async function issueDashboardBootstrapCode(): Promise<string> {
  const redis = getRedisConnection();
  const candidate = randomBytes(24).toString("base64url");
  const inserted = await redis.set(BOOTSTRAP_NONCE_KEY, candidate, "EX", BOOTSTRAP_TTL_SECONDS, "NX");
  const nonce = inserted ? candidate : await redis.get(BOOTSTRAP_NONCE_KEY);
  if (!nonce) throw new Error("Could not initialize dashboard setup code");
  return deriveDashboardBootstrapCode(nonce, getEncryptionKey());
}

export async function consumeDashboardBootstrapCode(code: string): Promise<boolean> {
  const redis = getRedisConnection();
  const nonce = await redis.get(BOOTSTRAP_NONCE_KEY);
  if (!nonce) return false;
  const expected = deriveDashboardBootstrapCode(nonce, getEncryptionKey());
  if (!timingSafeEqual(digest(expected), digest(code))) return false;

  const consumed = await redis.eval(
    "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
    1,
    BOOTSTRAP_NONCE_KEY,
    nonce,
  );
  return consumed === 1;
}
