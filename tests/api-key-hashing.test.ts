import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { apiKeys } from "../server/database/schema";
import { hashApiKey } from "../server/utils/auth";

describe("API key storage", () => {
  it("hashes API keys with SHA-256", () => {
    const rawKey = "01TESTKEY_550e8400-e29b-41d4-a716-446655440000";
    const hash = hashApiKey(rawKey);

    expect(hash).toBe("e3bff96fabe095bd2f0667f28af9351d18d77363040d9eda933e8ca64867354c");
    expect(hash).not.toContain(rawKey);
    expect(hashApiKey(rawKey)).toBe(hash);
  });

  it("has no plaintext API key database column", () => {
    expect(Object.keys(getTableColumns(apiKeys))).toEqual([
      "id",
      "keyHash",
      "keyPrefix",
      "email",
      "name",
      "active",
      "createdAt",
      "lastUsedAt",
    ]);
  });
});
