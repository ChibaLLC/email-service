import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateTransport = vi.fn();
const mockSendMail = vi.fn();
const mockVerify = vi.fn();

vi.mock("nodemailer", () => ({
  createTransport: (...args: unknown[]) => {
    mockCreateTransport(...args);
    return {
      sendMail: mockSendMail,
      verify: mockVerify,
    };
  },
}));

describe("NodemailerProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_USER: "mailer@example.com",
      SMTP_PASS: "secret",
      DEFAULT_FROM: "team@ifkafin.com",
    };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a transporter from SMTP config", async () => {
    const { NodemailerProvider } = await import("../server/email/providers/nodemailer");

    new NodemailerProvider();

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: {
        user: "mailer@example.com",
        pass: "secret",
      },
    });
  });

  it("sends email with mapped attachments and default from address", async () => {
    mockSendMail.mockResolvedValue({ messageId: "message_123" });

    const { NodemailerProvider } = await import("../server/email/providers/nodemailer");
    const provider = new NodemailerProvider();

    const result = await provider.send({
      to: ["allan.bosire@ifkafin.com", "team@ifkafin.com"],
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

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "team@ifkafin.com",
      to: "allan.bosire@ifkafin.com, team@ifkafin.com",
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
      messageId: "message_123",
    });
  });

  it("uses plain text payloads when html is absent", async () => {
    mockSendMail.mockResolvedValue({ messageId: "message_456" });

    const { NodemailerProvider } = await import("../server/email/providers/nodemailer");
    const provider = new NodemailerProvider();

    await provider.send({
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from Nodemailer",
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "team@ifkafin.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from Nodemailer",
    });
  });

  it("returns transport errors as failures", async () => {
    mockSendMail.mockRejectedValue(new Error("SMTP timeout"));

    const { NodemailerProvider } = await import("../server/email/providers/nodemailer");
    const provider = new NodemailerProvider();

    const result = await provider.send({
      from: "sender@example.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Hello",
      text: "Failure case",
    });

    expect(result).toEqual({
      success: false,
      error: "Error: SMTP timeout",
    });
  });

  it("verifies the transporter successfully", async () => {
    mockVerify.mockResolvedValue(undefined);

    const { NodemailerProvider } = await import("../server/email/providers/nodemailer");
    const provider = new NodemailerProvider();

    await expect(provider.verify?.()).resolves.toBe(true);
  });

  it("returns false when transporter verification fails", async () => {
    mockVerify.mockRejectedValue(new Error("Connection refused"));

    const { NodemailerProvider } = await import("../server/email/providers/nodemailer");
    const provider = new NodemailerProvider();

    await expect(provider.verify?.()).resolves.toBe(false);
  });
});