import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildEmailProviderConfig } from "../server/email/config";
import { decryptProviderSecrets, encryptProviderSecrets, serializeProviderConfig } from "../server/email/settings-codec";

describe("outbound settings helpers", () => {
  it("separates public provider config from secrets", () => {
    const complete = buildEmailProviderConfig({ provider: "postal", defaultFrom: "team@example.com", apiUrl: "https://postal.example.com", serverApiKey: "secret" });
    expect(serializeProviderConfig(complete)).toEqual({
      config: { defaultFrom: "team@example.com", apiUrl: "https://postal.example.com" },
      secrets: { serverApiKey: "secret" },
    });
  });

  it("encrypts secrets with settings-version-bound AAD", () => {
    const key = randomBytes(32);
    const encrypted = encryptProviderSecrets({ apiKey: "re_secret" }, key, "settings-1");
    expect(JSON.stringify(encrypted)).not.toContain("re_secret");
    expect(decryptProviderSecrets(encrypted, key, "settings-1")).toEqual({ apiKey: "re_secret" });
    expect(() => decryptProviderSecrets(encrypted, key, "settings-2")).toThrow();
  });
});
