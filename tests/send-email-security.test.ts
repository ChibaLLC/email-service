import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, sendEmailSchema } from "../server/email/request";

const validMessage = { to: "person@example.com", subject: "Hello", text: "Body" };

describe("send email request security", () => {
  it("rejects local and remote attachment paths", () => {
    expect(sendEmailSchema.safeParse({ ...validMessage, attachments: [{ filename: "secret", path: "/proc/self/environ" }] }).success).toBe(false);
    expect(sendEmailSchema.safeParse({ ...validMessage, attachments: [{ filename: "metadata", path: "http://169.254.169.254/" }] }).success).toBe(false);
  });

  it("rejects header injection and malformed recipients", () => {
    expect(sendEmailSchema.safeParse({ ...validMessage, subject: "Hello\r\nBcc: attacker@example.com" }).success).toBe(false);
    expect(sendEmailSchema.safeParse({ ...validMessage, to: "not-an-email" }).success).toBe(false);
  });

  it("accepts bounded inline attachments", () => {
    expect(sendEmailSchema.safeParse({ ...validMessage, attachments: [{ filename: "note.txt", content: "hello", contentType: "text/plain" }] }).success).toBe(true);
  });

  it("rejects decoded attachments above the limit", () => {
    const content = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1).toString("base64");
    expect(sendEmailSchema.safeParse({ ...validMessage, attachments: [{ filename: "large.bin", content, encoding: "base64" }] }).success).toBe(false);
  });
});
