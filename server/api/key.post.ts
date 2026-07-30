import { v4 } from "uuid";
import { ulid } from "ulid";
import { render } from "@vue-email/render";
import { hashApiKey } from "../utils/auth";
import { db, schema } from "../database";
import { getEmailProviderForSettings } from "../email/settings";
import ApiKeyEmail from "../emails/ApiKeyEmail.vue";
import { z } from "zod";
import { isApiKeyEmailAllowed } from "../settings/policy";

const apiKeyEmailSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export default defineEventHandler(async (event) => {
  const { data, error } = await readValidatedBody(event, apiKeyEmailSchema.safeParse);
  if (error) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
      cause: error.cause,
    });
  }

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

  // Render email template
  const html = await render(ApiKeyEmail, { apiKey: rawKey });

  // Send the key via email
  const result = await provider.send({
    to: data.email,
    subject: "Your Email Service API Key",
    html,
  });
  if (!result.success) throw createError({ statusCode: 502, message: `Could not send API key: ${result.error || "provider error"}` });

  return { success: true, message: "API key sent to your email" };
});
