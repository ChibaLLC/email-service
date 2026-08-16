import { describe, expect, it } from "vitest";
import {
  deriveDashboardBootstrapCode,
} from "../server/utils/dashboard-bootstrap";

describe("dashboard bootstrap code", () => {
  it("derives a stable code from the shared nonce and encryption key", () => {
    const key = Buffer.alloc(32, 7).toString("base64");
    const code = deriveDashboardBootstrapCode("test-nonce", key);

    expect(code).toBe("txP9-ZceL4yOqaSrEBcnaGTvcERLx5nJCeEV_tQun7w");
    expect(deriveDashboardBootstrapCode("test-nonce", key)).toBe(code);
    expect(deriveDashboardBootstrapCode("different-nonce", key)).not.toBe(code);
  });
});
