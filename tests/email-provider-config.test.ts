import { describe, expect, it } from "vitest";
import { buildEmailProviderConfig, getDefaultFromAddress } from "../server/email/config";

describe("email provider config", () => {
  it("validates and normalizes nodemailer settings", () => {
    expect(buildEmailProviderConfig({
      provider: "nodemailer",
      defaultFrom: "team@ifkafin.com",
      host: "smtp.example.com",
      port: "587",
      username: "mailer@example.com",
      password: "secret",
    })).toMatchObject({ EMAIL_PROVIDER: "nodemailer", SMTP_PORT: 587, SMTP_PASS: "secret" });
  });

  it("requires a provider secret for a new setting", () => {
    expect(() => buildEmailProviderConfig({ provider: "sendgrid", defaultFrom: "team@ifkafin.com" })).toThrow("apiKey is required");
  });

  it("allows a retained secret for a same-provider version", () => {
    const config = buildEmailProviderConfig({ provider: "sendgrid", defaultFrom: "new@ifkafin.com" }, { apiKey: "SG.retained" });
    expect(config).toMatchObject({ DEFAULT_FROM: "new@ifkafin.com", SENDGRID_API_KEY: "SG.retained" });
  });

  it("uses Resend's documented development sender when omitted", () => {
    const config = buildEmailProviderConfig({ provider: "resend", apiKey: "re_test_key" });
    expect(getDefaultFromAddress(config)).toBe("onboarding@resend.dev");
  });

  it("rejects unsupported providers", () => {
    expect(() => buildEmailProviderConfig({ provider: "postmark", apiKey: "secret" })).toThrow();
  });
});
