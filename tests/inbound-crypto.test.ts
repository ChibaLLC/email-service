import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createWebhookSignature,
  decryptInboundValue,
  encryptInboundValue,
  parseEncryptionKey,
  verifyWebhookSignature,
} from "../server/inbound/crypto";
import { assertSafeWebhookDestination } from "../server/inbound/network";

describe("inbound email encryption", () => {
  it("round-trips authenticated ciphertext with field-bound AAD", () => {
    const key = randomBytes(32);
    const encrypted = encryptInboundValue("mailbox-password", key, "inbound-config:password");

    expect(encrypted).not.toContain("mailbox-password");
    expect(decryptInboundValue(encrypted, key, "inbound-config:password").toString()).toBe("mailbox-password");
    expect(() => decryptInboundValue(encrypted, key, "inbound-config:webhook-secret")).toThrow();
  });

  it("rejects malformed encryption keys and tampered ciphertext", () => {
    expect(() => parseEncryptionKey("not-a-key")).toThrow("base64-encoded 32-byte key");
    const key = randomBytes(32);
    const encrypted = encryptInboundValue("raw MIME", key, "inbound-message:01");
    expect(() => decryptInboundValue(`${encrypted.slice(0, -1)}A`, key, "inbound-message:01")).toThrow();
  });
});

describe("inbound webhook security", () => {
  afterEach(() => delete process.env.INBOUND_WEBHOOK_ALLOW_PRIVATE_NETWORKS);

  it("signs the exact timestamp and body", () => {
    const body = JSON.stringify({ id: "event-1" });
    const signature = createWebhookSignature("a".repeat(32), "1785326400", body);

    expect(verifyWebhookSignature("a".repeat(32), "1785326400", body, signature)).toBe(true);
    expect(verifyWebhookSignature("a".repeat(32), "1785326400", `${body} `, signature)).toBe(false);
  });

  it("rejects insecure and loopback webhook destinations by default", async () => {
    await expect(assertSafeWebhookDestination("http://example.com/hook")).rejects.toThrow("must use HTTPS");
    await expect(assertSafeWebhookDestination("https://localhost/hook")).rejects.toThrow("private network");
  });
});
