import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSetting, encryptSetting, parseSettingsEncryptionKey } from "../server/settings/crypto";

describe("settings encryption", () => {
  it("round-trips a secret with integration and field-bound AAD", () => {
    const key = randomBytes(32);
    const encrypted = encryptSetting("api-password", key, "listmonk", "password");

    expect(encrypted).not.toContain("api-password");
    expect(decryptSetting(encrypted, key, "listmonk", "password")).toBe("api-password");
    expect(() => decryptSetting(encrypted, key, "other", "password")).toThrow();
    expect(() => decryptSetting(encrypted, key, "listmonk", "username")).toThrow();
  });

  it("accepts only canonical base64 32-byte keys", () => {
    const encoded = randomBytes(32).toString("base64");
    expect(parseSettingsEncryptionKey(encoded)).toHaveLength(32);
    expect(() => parseSettingsEncryptionKey("not-a-key")).toThrow("base64-encoded 32-byte key");
  });
});
