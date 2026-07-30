import { v4 } from "uuid";
import { ulid } from "ulid";
import { render } from "@vue-email/render";
import { hashApiKey } from "../utils/auth";
import { db, schema } from "../database";
import { getEmailProviderForSettings } from "../email/settings";
import ApiKeyEmail from "../emails/ApiKeyEmail.vue";
import { z } from "zod";
import { isApiKeyEmailAllowed } from "../settings/policy";
import { eq } from "drizzle-orm";
import { enforceRateLimit, requestSource } from "../security/rate-limit";
import { readLimitedJsonBody } from "../security/body";

const apiKeyEmailSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export default defineEventHandler(async (event) => {
  const { data, error } = apiKeyEmailSchema.safeParse(await readLimitedJsonBody(event, 4096));
  if (error) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
      cause: error.cause,
    });
  }

  await Promise.all([
    enforceRateLimit("api-key-email", data.email, 3, 60 * 60),
    enforceRateLimit("api-key-source", requestSource(event), 100, 60 * 60),
  ]);
  if (!(await isApiKeyEmailAllowed(data.email))) {
    throw createError({ statusCode: 403, message: "Email domain is not allowed for API keys" });
  }

  const { provider } = await getEmailProviderForSettings();

  // Generate a unique API key
  const rawKey = `${ulid()}_${v4()}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 8) + "...";

  // Store hashed key in database
  await db.insert(schema.apiKeys).values({
    keyHash,
    keyPrefix,
    email: data.email,
  });

  try {
    const html = await render(ApiKeyEmail, { apiKey: rawKey });
    const result = await provider.send({
      to: data.email,
      subject: "Your Email Service API Key",
      html,
    });
    if (!result.success) throw new Error(result.error || "provider error");
  } catch (error) {
    await db.delete(schema.apiKeys).where(eq(schema.apiKeys.keyHash, keyHash));
    console.error("[api-key] Key delivery failed", error instanceof Error ? error.message : error);
    throw createError({ statusCode: 502, message: "Could not send API key" });
  }

  return { success: true, message: "API key sent to your email" };
});
