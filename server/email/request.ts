import { z } from "zod";

export const MAX_MESSAGE_BYTES = 1_000_000;
export const MAX_ATTACHMENT_BYTES = 10_000_000;
export const MAX_TOTAL_ATTACHMENT_BYTES = 15_000_000;

const noHeaderControls = (value: string) => !/[\r\n\0]/.test(value);
const address = z.string().trim().max(320).email().refine(noHeaderControls, "Email addresses must not contain control characters");
const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255).refine(noHeaderControls, "Attachment filenames must not contain control characters"),
  content: z.string().min(1).max(Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 4),
  contentType: z.string().trim().min(1).max(255).regex(/^[\w.+-]+\/[\w.+-]+$/, "Invalid attachment content type").optional(),
  encoding: z.literal("base64").optional(),
}).strict();

export const sendEmailSchema = z.object({
  from: address.optional(),
  to: z.union([address, z.array(address).min(1).max(50)]),
  subject: z.string().trim().min(1).max(200).refine(noHeaderControls, "Subject must not contain control characters"),
  attachments: z.array(attachmentSchema).max(10).optional(),
}).and(z.union([
  z.object({ text: z.string().min(1).max(MAX_MESSAGE_BYTES) }),
  z.object({ html: z.string().min(1).max(MAX_MESSAGE_BYTES) }),
])).superRefine((value, context) => {
  const totalBytes = (value.attachments || []).reduce((total, attachment) => {
    const bytes = attachment.encoding === "base64"
      ? Buffer.byteLength(attachment.content, "base64")
      : Buffer.byteLength(attachment.content, "utf8");
    if (bytes > MAX_ATTACHMENT_BYTES) context.addIssue({ code: "custom", path: ["attachments"], message: "An attachment exceeds the 10 MB limit" });
    return total + bytes;
  }, 0);
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) context.addIssue({ code: "custom", path: ["attachments"], message: "Attachments exceed the 15 MB total limit" });
});
