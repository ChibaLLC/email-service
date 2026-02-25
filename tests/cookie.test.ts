import { describe, it, expect } from "vitest";
import { DASHBOARD_COOKIE_NAME, getDashboardCookieOptions } from "../server/utils/cookie";

describe("Cookie Configuration", () => {
  describe("DASHBOARD_COOKIE_NAME", () => {
    it("should be a non-empty string constant", () => {
      expect(DASHBOARD_COOKIE_NAME).toBe("dashboard_token");
      expect(typeof DASHBOARD_COOKIE_NAME).toBe("string");
    });
  });

  describe("getDashboardCookieOptions()", () => {
    it("should return default cookie options", () => {
      const options = getDashboardCookieOptions();

      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.maxAge).toBe(60 * 60 * 24); // 24 hours
      expect(options.path).toBe("/");
    });

    it("should set secure to true in production", () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const options = getDashboardCookieOptions();
      expect(options.secure).toBe(true);

      process.env.NODE_ENV = original;
    });

    it("should set secure to false in development", () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const options = getDashboardCookieOptions();
      expect(options.secure).toBe(false);

      process.env.NODE_ENV = original;
    });

    it("should allow overriding specific options", () => {
      const options = getDashboardCookieOptions({ maxAge: 0 });

      expect(options.maxAge).toBe(0);
      expect(options.httpOnly).toBe(true); // unchanged
      expect(options.path).toBe("/"); // unchanged
    });

    it("should allow overriding path", () => {
      const options = getDashboardCookieOptions({ path: "/dashboard" });
      expect(options.path).toBe("/dashboard");
    });
  });
});
