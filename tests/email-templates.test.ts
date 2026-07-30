import { render } from "@vue-email/render";
import { describe, expect, it } from "vitest";
import ApiKeyEmail from "../server/emails/ApiKeyEmail.vue";
import OtpEmail from "../server/emails/OtpEmail.vue";
import TestEmail from "../server/emails/TestEmail.vue";

describe("transactional email templates", () => {
  it("renders a concise sign-in email", async () => {
    const html = await render(OtpEmail, { code: "123456" });

    expect(html).toContain("Sign in to your dashboard");
    expect(html).toContain("123456");
    expect(html).toContain("expires in 5 minutes");
    expect(html).not.toContain("letter-spacing:8px");
  });

  it("renders an API key with practical usage guidance", async () => {
    const html = await render(ApiKeyEmail, { apiKey: "example-api-key" });

    expect(html).toContain("example-api-key");
    expect(html).toContain("only be shown once");
    expect(html).toContain("Authorization");
  });

  it("renders a plain-language delivery confirmation", async () => {
    const html = await render(TestEmail, {
      email: "person@example.com",
      provider: "smtp",
      sentAt: "2026-07-30T18:00:00.000Z",
    });

    expect(html).toContain("Your test email arrived");
    expect(html).toContain("delivery through");
    expect(html).toContain("smtp");
    expect(html).not.toContain("configured provider can accept mail from this environment");
  });
});
