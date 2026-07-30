import { db, schema } from "../database";
import { getDefaultFromAddress } from "../email/config";
import { getActiveOutboundSettings } from "../email/settings";
import { addEmailJob } from "../queue/email.queue";
import { hashApiKey } from "../utils/auth";
import { eq } from "drizzle-orm";
import { sendEmailSchema } from "../email/request";
import { enforceRateLimit } from "../security/rate-limit";
import { readLimitedJsonBody } from "../security/body";

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
  const { data, error } = sendEmailSchema.safeParse(await readLimitedJsonBody(event, 22_000_000));
  if (error) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.flatten(),
    });
  }

  const outbound = await getActiveOutboundSettings();
  await enforceRateLimit("send", apiKey.id, 60, 60);
  const defaultFrom = getDefaultFromAddress(outbound.config).toLowerCase();
  const requestedFrom = data.from?.toLowerCase();
  if (requestedFrom && requestedFrom !== apiKey.email.toLowerCase() && requestedFrom !== defaultFrom) {
    throw createError({ statusCode: 403, message: "This API key is not authorized for the requested sender" });
  }
  const from = requestedFrom || defaultFrom;
  const bodyType = "html" in data ? "html" : "text";
  const attachments = data.attachments?.map((attachment) => ({
    ...attachment,
    content: attachment.encoding === "base64" ? attachment.content : Buffer.from(attachment.content, "utf8").toString("base64"),
    encoding: "base64" as const,
  }));

  // Insert email record
  const [emailRecord] = await db
    .insert(schema.emails)
    .values({
      apiKeyId: apiKey.id,
      outboundSettingsId: outbound.id,
      from,
      to: Array.isArray(data.to) ? data.to.join(", ") : data.to,
      subject: data.subject,
      bodyType,
      status: "queued",
    })
    .returning();

  // Queue the job
  try {
    await addEmailJob({
      emailId: emailRecord!.id,
      outboundSettingsId: outbound.id,
      from,
      to: data.to,
      subject: data.subject,
      ...("html" in data ? { html: data.html } : { text: data.text }),
      ...(attachments?.length ? { attachments } : {}),
    });
  } catch (error) {
    await db.update(schema.emails).set({ status: "failed", error: "Could not enqueue email" }).where(eq(schema.emails.id, emailRecord!.id));
    throw error;
  }

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
