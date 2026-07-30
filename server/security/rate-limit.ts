import { createHash } from "node:crypto";
import type { H3Event } from "h3";
import { getRedisConnection } from "../queue/connection";

function digest(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

export function requestSource(event: H3Event): string {
  return event.node.req.socket.remoteAddress || "unknown";
}

export async function enforceRateLimit(scope: string, subject: string, limit: number, windowSeconds: number): Promise<void> {
  const redis = getRedisConnection();
  const key = `rate:${scope}:${digest(subject)}`;
  const count = Number(await redis.eval(`
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return count
  `, 1, key, windowSeconds));
  if (count > limit) {
    throw createError({ statusCode: 429, message: "Too many requests. Try again later." });
  }
}
