import type { CookieSerializeOptions } from "cookie-es";

export const DASHBOARD_COOKIE_NAME = "dashboard_token";

export function getDashboardCookieOptions(overrides?: Partial<CookieSerializeOptions>): CookieSerializeOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
    ...overrides,
  };
}
