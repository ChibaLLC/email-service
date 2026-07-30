import { describe, expect, it } from "vitest";
import { createWebhookSignature } from "../server/inbound/crypto";
import { buildInboundWebhookPreview } from "../server/inbound/webhook-preview";

describe("inbound webhook preview", () => {
  it("returns the exact request preview shape with a valid signature", () => {
    const now = new Date("2026-07-30T12:00:00.000Z");
    const secret = "01234567890123456789012345678901";
    const preview = buildInboundWebhookPreview({ name: "Calendar", url: "https://example.com/hook" }, secret, now);

    expect(Object.keys(preview)).toEqual(["url", "method", "headers", "body", "curl", "status"]);
    expect(preview.status).toBeNull();
    expect(preview.headers["x-email-service-signature"]).toBe(
      createWebhookSignature(secret, preview.headers["x-email-service-timestamp"], preview.body),
    );
    expect(preview.curl).toContain("'https://example.com/hook'");
  });
});
