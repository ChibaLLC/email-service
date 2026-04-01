import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockResendConstructor = vi.fn();
const mockSend = vi.fn();

vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: mockSend,
    };

    constructor(apiKey: string) {
      mockResendConstructor(apiKey);
    }
  },
}));

describe("ResendProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.RESEND_API_KEY;
    delete process.env.DEFAULT_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("throws when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    const { ResendProvider } = await import("../server/email/providers/resend");

    expect(() => new ResendProvider()).toThrow(/RESEND_API_KEY is required/);
  });

  it("sends email with mapped attachments and default from address", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });

    const { ResendProvider } = await import("../server/email/providers/resend");
    const provider = new ResendProvider();

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

    expect(mockResendConstructor).toHaveBeenCalledWith("re_test_key");
    expect(mockSend).toHaveBeenCalledWith({
      from: "team@ifkafin.com",
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
    expect(result).toEqual({
      success: true,
      messageId: "email_123",
    });
  });

  it("falls back to Resend onboarding sender when DEFAULT_FROM is unset", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.DEFAULT_FROM;
    mockSend.mockResolvedValue({
      data: { id: "email_456" },
      error: null,
    });

    const { ResendProvider } = await import("../server/email/providers/resend");
    const provider = new ResendProvider();

    await provider.send({
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from Resend",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "onboarding@resend.dev",
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from Resend",
    });
  });

  it("returns provider errors without throwing", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockResolvedValue({
      data: null,
      error: { message: "Sender domain is not verified" },
    });

    const { ResendProvider } = await import("../server/email/providers/resend");
    const provider = new ResendProvider();

    const result = await provider.send({
      from: "sender@example.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Hello",
      text: "Failure case",
    });

    expect(result).toEqual({
      success: false,
      error: "Sender domain is not verified",
    });
  });

  it("returns thrown client errors as failures", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    mockSend.mockRejectedValue(new Error("network timeout"));

    const { ResendProvider } = await import("../server/email/providers/resend");
    const provider = new ResendProvider();

    const result = await provider.send({
      from: "sender@example.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Hello",
      text: "Failure case",
    });

    expect(result).toEqual({
      success: false,
      error: "network timeout",
    });
  });
});