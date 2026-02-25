import { v4 } from "uuid";
import { ulid } from "ulid";
import { render } from "@vue-email/render";
import { hashApiKey } from "../utils/auth";
import { db, schema } from "../database";
import { getEmailProvider } from "../email/providers";
import ApiKeyEmail from "../emails/ApiKeyEmail.vue";

export default defineEventHandler(async (event) => {
  const { data, error } = await readValidatedBody(event, emailShema.safeParse);
  if (error) {
    throw createError({
      statusCode: 400,
      message: error.message,
      data: error.errors,
      cause: error.cause,
    });
  }

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
  const provider = getEmailProvider();
  await provider.send({
    to: data.email,
    subject: "Your Email Service API Key",
    html,
  });

  return { success: true, message: "API key sent to your email" };
});
