import { randomInt } from "node:crypto";
import { getRedisConnection } from "../queue/connection";

const OTP_TTL_SECONDS = 5 * 60; // 5 minutes
const OTP_PREFIX = "otp:";

/**
 * Generate a 6-digit OTP, store it in Redis with a TTL, and return the code.
 */
export async function generateOTP(email: string): Promise<string> {
  const code = String(randomInt(100000, 999999));
  const redis = getRedisConnection();
  const key = `${OTP_PREFIX}${email.toLowerCase()}`;

  // Store with TTL — overwrites any existing OTP for this email
  await redis.set(key, code, "EX", OTP_TTL_SECONDS);

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

  const stored = await redis.get(key);
  if (!stored || stored !== code) {
    return false;
  }

  // Delete on success — one-time use
  redis.del(key);
  return true;
}
