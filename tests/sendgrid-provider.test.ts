import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSetApiKey = vi.fn();
const mockSend = vi.fn();
const mockRequest = vi.fn();
const config = { EMAIL_PROVIDER: "sendgrid" as const, DEFAULT_FROM: "team@ifkafin.com", SENDGRID_API_KEY: "SG.test-key" };

vi.mock("@sendgrid/mail", () => ({
  default: {
    constructor: class {
      client = { request: mockRequest };
      setApiKey = mockSetApiKey;
      send = mockSend;
    },
  },
}));

describe("SendGridProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SENDGRID_API_KEY;
    delete process.env.DEFAULT_FROM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sends email with mapped attachments and default from address", async () => {
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockResolvedValue([
      {
        headers: {
          "x-message-id": "sg_message_123",
        },
      },
      {},
    ]);

    const { SendGridProvider } = await import("../server/email/providers/sendgrid");
    const provider = new SendGridProvider(config);

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

    expect(mockSetApiKey).toHaveBeenCalledWith("SG.test-key");
    expect(mockSend).toHaveBeenCalledWith({
      from: "team@ifkafin.com",
      to: ["allan.bosire@ifkafin.com"],
      subject: "Hello World",
      html: "<p>Hello</p>",
      attachments: [
        {
          filename: "hello.txt",
          content: "SGVsbG8=",
          type: "text/plain",
          disposition: "attachment",
        },
      ],
    });
    expect(result).toEqual({
      success: true,
      messageId: "sg_message_123",
    });
  });

  it("uses a plain text payload when html is absent", async () => {
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockResolvedValue([{ headers: {} }, {}]);

    const { SendGridProvider } = await import("../server/email/providers/sendgrid");
    const provider = new SendGridProvider(config);

    await provider.send({
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from SendGrid",
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: "team@ifkafin.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from SendGrid",
    });
  });

  it("returns SendGrid API error messages without throwing", async () => {
    process.env.SENDGRID_API_KEY = "SG.test-key";
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    mockSend.mockRejectedValue({
      message: "request failed",
      response: {
        body: {
          errors: [{ message: "The from address does not match a verified Sender Identity." }],
        },
      },
    });

    const { SendGridProvider } = await import("../server/email/providers/sendgrid");
    const provider = new SendGridProvider(config);

    const result = await provider.send({
      from: "sender@example.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Hello",
      text: "Failure case",
    });

    expect(result).toEqual({
      success: false,
      error: "The from address does not match a verified Sender Identity.",
    });
  });
});
