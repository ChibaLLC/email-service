import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFactory = vi.fn();
const mockSend = vi.fn();
const mockPing = vi.fn();

vi.mock("@mailchimp/mailchimp_transactional", () => ({
  default: (apiKey: string) => {
    mockFactory(apiKey);
    return {
      messages: {
        send: mockSend,
      },
      users: {
        ping: mockPing,
      },
    };
  },
}));

describe("MailchimpProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.MAILCHIMP_TRANSACTIONAL_API_KEY;
    delete process.env.DEFAULT_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when MAILCHIMP_TRANSACTIONAL_API_KEY is missing", async () => {
    const { MailchimpProvider } = await import("../server/email/providers/mailchimp");

    expect(() => new MailchimpProvider()).toThrow(/MAILCHIMP_TRANSACTIONAL_API_KEY is required/);
  });

  it("sends email with mapped recipients and attachments", async () => {
    process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "mc_test_key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockResolvedValue([
      {
        _id: "mc_message_123",
        status: "sent",
      },
    ]);

    const { MailchimpProvider } = await import("../server/email/providers/mailchimp");
    const provider = new MailchimpProvider();

    const result = await provider.send({
      to: ["allan.bosire@ifkafin.com"],
      subject: "Hello World",
      html: "<p>Hello</p>",
      attachments: [
        {
          filename: "hello.txt",
          content: "SGVsbG8=",
          contentType: "text/plain",
        },
      ],
    });

    expect(mockFactory).toHaveBeenCalledWith("mc_test_key");
    expect(mockSend).toHaveBeenCalledWith({
      message: {
        from_email: "team@ifkafin.com",
        to: [{ email: "allan.bosire@ifkafin.com", type: "to" }],
        subject: "Hello World",
        html: "<p>Hello</p>",
        attachments: [
          {
            type: "text/plain",
            name: "hello.txt",
            content: "SGVsbG8=",
          },
        ],
      },
    });
    expect(result).toEqual({
      success: true,
      messageId: "mc_message_123",
    });
  });

  it("uses a plain text payload when html is absent", async () => {
    process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "mc_test_key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockResolvedValue([{ _id: "mc_message_456", status: "sent" }]);

    const { MailchimpProvider } = await import("../server/email/providers/mailchimp");
    const provider = new MailchimpProvider();

    await provider.send({
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from Mailchimp",
    });

    expect(mockSend).toHaveBeenCalledWith({
      message: {
        from_email: "team@ifkafin.com",
        to: [{ email: "allan.bosire@ifkafin.com", type: "to" }],
        subject: "Plain Text",
        text: "Hello from Mailchimp",
      },
    });
  });

  it("returns rejected mailchimp sends as failures", async () => {
    process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "mc_test_key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockResolvedValue([
      {
        status: "rejected",
        reject_reason: "unsigned-sender",
      },
    ]);

    const { MailchimpProvider } = await import("../server/email/providers/mailchimp");
    const provider = new MailchimpProvider();

    const result = await provider.send({
      from: "sender@example.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Hello",
      text: "Failure case",
    });

    expect(result).toEqual({
      success: false,
      error: "unsigned-sender",
    });
  });

  it("verifies the API key via ping", async () => {
    process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "mc_test_key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockPing.mockResolvedValue("PONG!");

    const { MailchimpProvider } = await import("../server/email/providers/mailchimp");
    const provider = new MailchimpProvider();

    await expect(provider.verify?.()).resolves.toBe(true);
  });

  it("returns false when ping fails", async () => {
    process.env.MAILCHIMP_TRANSACTIONAL_API_KEY = "mc_test_key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockPing.mockRejectedValue(new Error("invalid api key"));

    const { MailchimpProvider } = await import("../server/email/providers/mailchimp");
    const provider = new MailchimpProvider();

    await expect(provider.verify?.()).resolves.toBe(false);
  });
});