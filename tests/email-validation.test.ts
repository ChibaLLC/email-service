import { describe, it, expect } from "vitest";
import { validateEmail, getAllowedDomains } from "../shared/utils/utils";

describe("Email Validation", () => {
  it("should accept emails from allowed domains", () => {
    expect(validateEmail("user@ifkafin.com").valid).toBe(true);
    expect(validateEmail("user@finueva.com").valid).toBe(true);
    expect(validateEmail("user@heilomeet.com").valid).toBe(true);
  });

  it("should reject emails from unknown domains", () => {
    expect(validateEmail("user@gmail.com").valid).toBe(false);
    expect(validateEmail("user@example.com").valid).toBe(false);
    expect(validateEmail("hacker@evil.com").valid).toBe(false);
  });

  it("should be case-insensitive", () => {
    expect(validateEmail("USER@IFKAFIN.COM").valid).toBe(true);
    expect(validateEmail("Admin@FinUeva.COM").valid).toBe(true);
  });

  it("should return the domain type for valid emails", () => {
    const result = validateEmail("user@ifkafin.com");
    expect(result.valid).toBe(true);
    expect(result.type).toBe("ifkafin");
  });

  it("should return invalid for empty strings", () => {
    expect(validateEmail("").valid).toBe(false);
    expect(validateEmail("").type).toBeUndefined();
  });

  it("should not match partial domain names", () => {
    // "notifkafin.com" should NOT match "ifkafin.com"
    expect(validateEmail("user@notifkafin.com").valid).toBe(false);
  });

  describe("getAllowedDomains()", () => {
    it("should return default domains when no env is set", () => {
      const original = process.env.ALLOWED_DOMAINS;
      delete process.env.ALLOWED_DOMAINS;
      delete process.env.NUXT_PUBLIC_ALLOWED_DOMAINS;

      const domains = getAllowedDomains();
      expect(domains).toContain("ifkafin.com");
      expect(domains).toContain("finueva.com");
      expect(domains).toContain("heilomeet.com");

      // Restore
      if (original) process.env.ALLOWED_DOMAINS = original;
    });

    it("should parse ALLOWED_DOMAINS env var", () => {
      const original = process.env.ALLOWED_DOMAINS;
      process.env.ALLOWED_DOMAINS = "custom.com,another.org";

      const domains = getAllowedDomains();
      expect(domains).toContain("custom.com");
      expect(domains).toContain("another.org");
      expect(domains).not.toContain("ifkafin.com");

      // Restore
      if (original) {
        process.env.ALLOWED_DOMAINS = original;
      } else {
        delete process.env.ALLOWED_DOMAINS;
      }
    });
  });
});
