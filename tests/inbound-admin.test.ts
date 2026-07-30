import { describe, expect, it } from "vitest";
import { canAccessWebhookCredentials, canManageWebhook } from "../server/inbound/admin";

describe("inbound webhook permissions", () => {
  it("allows members to manage and test their own webhooks", () => {
    const member = { email: "member@example.com", canModerate: false };
    expect(canManageWebhook(member, member.email)).toBe(true);
    expect(canAccessWebhookCredentials(member.email, member.email)).toBe(true);
  });

  it("allows admins to moderate without exposing another owner's credentials", () => {
    const admin = { email: "admin@example.com", canModerate: true };
    expect(canManageWebhook(admin, "member@example.com")).toBe(true);
    expect(canAccessWebhookCredentials(admin.email, "member@example.com")).toBe(false);
  });
});
