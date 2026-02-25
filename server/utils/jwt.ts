import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const ALG = "HS256";

export interface DashboardJWTPayload extends JWTPayload {
  email: string;
}

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signJWT(payload: { email: string }, secret: string, expiresIn = "24h"): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecretKey(secret));
}

export async function verifyJWT(token: string, secret: string): Promise<DashboardJWTPayload> {
  const { payload } = await jwtVerify(token, getSecretKey(secret));
  return payload as DashboardJWTPayload;
}

/**
 * Get JWT_SECRET from env with a clear error if missing.
 */
export function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw createError({
      statusCode: 500,
      message: "JWT_SECRET is not configured",
    });
  }
  return secret;
}
