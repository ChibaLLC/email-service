import { describe, expect, it } from "vitest";
import {
  getDefaultFromAddress,
  getSelectedEmailProviderName,
  parseEmailProviderConfig,
  validateSelectedEmailProviderConfig,
} from "../server/email/config";

describe("email provider config", () => {
  it("defaults EMAIL_PROVIDER to nodemailer", () => {
    expect(
      getSelectedEmailProviderName({
        DEFAULT_FROM: "team@ifkafin.com",
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_USER: "mailer@example.com",
        SMTP_PASS: "secret",
      }),
    ).toBe("nodemailer");
  });

  it("validates selected provider env for nodemailer", () => {
    const config = validateSelectedEmailProviderConfig({
      EMAIL_PROVIDER: "nodemailer",
      DEFAULT_FROM: "team@ifkafin.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "mailer@example.com",
      SMTP_PASS: "secret",
    });

    expect(config).toMatchObject({
      EMAIL_PROVIDER: "nodemailer",
      DEFAULT_FROM: "team@ifkafin.com",
      SMTP_PORT: 587,
    });
  });

  it("fails with meaningful messages for missing selected provider env", () => {
    expect(() =>
      validateSelectedEmailProviderConfig({
        EMAIL_PROVIDER: "sendgrid",
      }),
    ).toThrow(/Invalid email configuration for provider "sendgrid"/);
    expect(() =>
      validateSelectedEmailProviderConfig({
        EMAIL_PROVIDER: "sendgrid",
      }),
    ).toThrow(/SENDGRID_API_KEY is required/);
  });

  it("parses resend config and keeps DEFAULT_FROM optional", () => {
    const config = parseEmailProviderConfig("resend", {
      RESEND_API_KEY: "re_test_key",
    });

    expect(config.EMAIL_PROVIDER).toBe("resend");
    expect(getDefaultFromAddress(config)).toBe("onboarding@resend.dev");
  });

  it("rejects unsupported EMAIL_PROVIDER values", () => {
    expect(() =>
      getSelectedEmailProviderName({
        EMAIL_PROVIDER: "postmark",
      }),
    ).toThrow(/EMAIL_PROVIDER must be one of/);
  });
});