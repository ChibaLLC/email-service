import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();

describe("PostalProvider", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.DEFAULT_FROM = "team@ifkafin.com";
    process.env.POSTAL_API_URL = "http://postal.test";
    process.env.POSTAL_SERVER_API_KEY = "postal_test_key";
    vi.doMock("std-env", () => ({ env: process.env }));
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock("std-env");
    if (originalFetch) {
      vi.stubGlobal("fetch", originalFetch);
    } else {
      vi.unstubAllGlobals();
    }
  });

  it("throws when POSTAL_SERVER_API_KEY is missing", async () => {
    delete process.env.POSTAL_SERVER_API_KEY;

    const { PostalProvider } = await import("../server/email/providers/postal");

    expect(() => new PostalProvider()).toThrow(/POSTAL_SERVER_API_KEY is required/);
  });

  it("sends email with mapped attachments and default from address", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        status: "success",
        data: {
          message_id: "postal_message_123",
        },
      }),
    });

    const { PostalProvider } = await import("../server/email/providers/postal");
    const provider = new PostalProvider();

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

    expect(mockFetch).toHaveBeenCalledWith("http://postal.test/api/v1/send/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Server-API-Key": "postal_test_key",
      },
      body: JSON.stringify({
        from: "team@ifkafin.com",
        to: ["allan.bosire@ifkafin.com"],
        subject: "Hello World",
        html_body: "<p>Hello</p>",
        attachments: [
          {
            name: "hello.txt",
            data: "SGVsbG8=",
            content_type: "text/plain",
          },
        ],
      }),
    });
    expect(result).toEqual({
      success: true,
      messageId: "postal_message_123",
    });
  });

  it("uses a plain text payload when html is absent", async () => {
    process.env.POSTAL_API_URL = "http://postal.test/api/v1";
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: vi.fn().mockResolvedValue({
        status: "success",
        data: {},
      }),
    });

    const { PostalProvider } = await import("../server/email/providers/postal");
    const provider = new PostalProvider();

    await provider.send({
      to: "allan.bosire@ifkafin.com",
      subject: "Plain Text",
      text: "Hello from Postal",
    });

    expect(mockFetch).toHaveBeenCalledWith("http://postal.test/api/v1/send/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Server-API-Key": "postal_test_key",
      },
      body: JSON.stringify({
        from: "team@ifkafin.com",
        to: ["allan.bosire@ifkafin.com"],
        subject: "Plain Text",
        plain_body: "Hello from Postal",
      }),
    });
  });

  it("returns Postal API errors without throwing", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 422,
      statusText: "Unprocessable Entity",
      json: vi.fn().mockResolvedValue({
        status: "error",
        data: {
          errors: {
            from: ["The from address is not authorised to send mail from this server"],
          },
        },
      }),
    });

    const { PostalProvider } = await import("../server/email/providers/postal");
    const provider = new PostalProvider();

    const result = await provider.send({
      from: "sender@example.com",
      to: "allan.bosire@ifkafin.com",
      subject: "Hello",
      text: "Failure case",
    });

    expect(result).toEqual({
      success: false,
      error: "The from address is not authorised to send mail from this server",
    });
  });

  it("returns thrown client errors as failures", async () => {
    mockFetch.mockRejectedValue(new Error("network timeout"));

    const { PostalProvider } = await import("../server/email/providers/postal");
    const provider = new PostalProvider();

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