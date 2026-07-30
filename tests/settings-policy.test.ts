import { describe, expect, it } from "vitest";
import { accessSettingsInputSchema, emailCanLogIn, emailMatchesDomains, isAdminRole, parseEnvList } from "../server/settings/policy";

describe("dashboard settings policy", () => {
  it("matches exact and nested email domains without suffix confusion", () => {
    expect(emailMatchesDomains("user@example.com", ["example.com"])).toBe(true);
    expect(emailMatchesDomains("user@dept.example.com", ["example.com"])).toBe(true);
    expect(emailMatchesDomains("user@notexample.com", ["example.com"])).toBe(false);
    expect(emailMatchesDomains("example.com", ["example.com"])).toBe(false);
  });

  it("allows an exact member outside the broad login domains", () => {
    expect(emailCanLogIn("owner@outside.test", ["example.com"], [{ email: "owner@outside.test" }])).toBe(true);
    expect(emailCanLogIn("other@outside.test", ["example.com"], [{ email: "owner@outside.test" }])).toBe(false);
  });

  it("normalizes environment lists and recognizes only administrative roles", () => {
    expect(parseEnvList(" Admin@Example.com, admin@example.com, other@example.com ")).toEqual([
      "admin@example.com",
      "other@example.com",
    ]);
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("operator")).toBe(false);
    expect(isAdminRole("viewer")).toBe(false);
  });

  it("rejects access policies that remove or demote the last owner", () => {
    const base = { loginDomains: ["example.com"], apiKeyDomains: ["api.example.com"] };
    expect(accessSettingsInputSchema.safeParse({ ...base, members: [{ email: "owner@example.com", role: "owner" }] }).success).toBe(true);
    expect(accessSettingsInputSchema.safeParse({ ...base, members: [{ email: "admin@example.com", role: "admin" }] }).success).toBe(false);
    expect(accessSettingsInputSchema.safeParse({ ...base, members: [] }).success).toBe(false);
  });

  it("rejects duplicate members and malformed domains", () => {
    expect(accessSettingsInputSchema.safeParse({
      loginDomains: ["not a domain"],
      apiKeyDomains: ["example.com"],
      members: [
        { email: "owner@example.com", role: "owner" },
        { email: "OWNER@example.com", role: "admin" },
      ],
    }).success).toBe(false);
  });
});
