import { randomInt } from "node:crypto";
import { getRedisConnection } from "../queue/connection";

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_PREFIX = "otp:";

/**
 * Generate a 6-digit OTP, store it in Redis with a TTL, and return the code.
 */
export async function generateOTP(email: string): Promise<string> {
  const code = String(randomInt(100000, 999999));
  const redis = getRedisConnection();
  const key = `${OTP_PREFIX}${email.toLowerCase()}`;

  await redis.multi().del(key).hset(key, { code, attempts: "0" }).expire(key, OTP_TTL_SECONDS).exec();

  return code;
}

/**
 * Verify an OTP code for a given email.
 * Returns true if valid, false otherwise.
 * Deletes the OTP on successful verification (one-time use).
 */
export async function verifyOTP(email: string, code: string): Promise<boolean> {
  const redis = getRedisConnection();
  const key = `${OTP_PREFIX}${email.toLowerCase()}`;

  const result = await redis.eval(`
    local stored = redis.call('HGET', KEYS[1], 'code')
    if not stored then return 0 end
    local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
    if stored == ARGV[1] then
      redis.call('DEL', KEYS[1])
      return 1
    end
    if attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) end
    return 0
  `, 1, key, code, OTP_MAX_ATTEMPTS);
  return result === 1;
}
