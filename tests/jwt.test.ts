import { describe, it, expect } from "vitest";
import { signJWT, verifyJWT } from "../server/utils/jwt";

const TEST_SECRET = "test-secret-key-for-vitest-32chars!!";

describe("JWT (jose)", () => {
  it("should sign and verify a JWT successfully", async () => {
    const token = await signJWT({ email: "test@ifkafin.com" }, TEST_SECRET);

    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const payload = await verifyJWT(token, TEST_SECRET);

    expect(payload.email).toBe("test@ifkafin.com");
    expect(payload.iat).toBeDefined();
    expect(payload.exp).toBeDefined();
  });

  it("should reject a JWT with wrong secret", async () => {
    const token = await signJWT({ email: "test@ifkafin.com" }, TEST_SECRET);

    await expect(verifyJWT(token, "wrong-secret")).rejects.toThrow();
  });

  it("should reject a tampered JWT", async () => {
    const token = await signJWT({ email: "test@ifkafin.com" }, TEST_SECRET);
    const tampered = token.slice(0, -5) + "XXXXX";

    await expect(verifyJWT(tampered, TEST_SECRET)).rejects.toThrow();
  });

  it("should reject an expired JWT", async () => {
    // Sign with 0 seconds expiry
    const token = await signJWT({ email: "test@ifkafin.com" }, TEST_SECRET, "0s");

    // Wait a tiny bit for expiry
    await new Promise((r) => setTimeout(r, 1100));

    await expect(verifyJWT(token, TEST_SECRET)).rejects.toThrow();
  });

  it("should include the email in the payload", async () => {
    const email = "admin@example.com";
    const token = await signJWT({ email }, TEST_SECRET);
    const payload = await verifyJWT(token, TEST_SECRET);

    expect(payload.email).toBe(email);
  });

  it("should set expiration time correctly", async () => {
    const token = await signJWT({ email: "test@ifkafin.com" }, TEST_SECRET, "1h");
    const payload = await verifyJWT(token, TEST_SECRET);

    const expectedExp = (payload.iat ?? 0) + 3600;
    expect(payload.exp).toBe(expectedExp);
  });
});
