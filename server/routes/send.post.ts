import { z } from "zod";
import { db, schema } from "../database";
import { addEmailJob } from "../queue/email.queue";
import { hashApiKey } from "../utils/auth";
import { eq } from "drizzle-orm";

const sendSchema = z
  .object({
    from: z
      .string()
      .optional()
      .refine(
        (email) => (email ? validateEmail(email).valid : true),
        "The 'from' email provided is not a valid email.",
      ),
    to: z.union([z.string(), z.array(z.string())]),
    subject: z.string(),
  })
  .and(z.union([z.object({ text: z.string() }), z.object({ html: z.string() })]));

export default defineEventHandler(async (event) => {
  // Authenticate
  const token = readAuthToken(event);
  if (!token) {
    throw createError({ statusCode: 401, message: "Missing API key" });
  }

  const keyHash = hashApiKey(token);
  const [apiKey] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, keyHash)).limit(1);

  if (!apiKey || !apiKey.active) {
    throw createError({
      statusCode: 401,
      message: "Invalid or revoked API key",
    });
  }

  // Validate body
  const { data, error } = await readValidatedBody(event, sendSchema.safeParse);
  if (error) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: await readBody(event),
      cause: error.cause,
    });
  }

  const from = data.from || process.env.DEFAULT_FROM || "noreply@ifkafin.com";
  const bodyType = "html" in data ? "html" : "text";

  // Insert email record
  const [emailRecord] = await db
    .insert(schema.emails)
    .values({
      apiKeyId: apiKey.id,
      from,
      to: Array.isArray(data.to) ? data.to.join(", ") : data.to,
      subject: data.subject,
      bodyType,
      status: "queued",
    })
    .returning();

  // Queue the job
  await addEmailJob({
    emailId: emailRecord!.id,
    from,
    to: data.to,
    subject: data.subject,
    ...("html" in data ? { html: data.html } : { text: data.text }),
  });

  // Update last used
  db.update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, apiKey.id))
    .catch(() => {});

  return {
    id: emailRecord!.id,
    status: "queued",
    message: "Email queued for delivery",
  };
});
