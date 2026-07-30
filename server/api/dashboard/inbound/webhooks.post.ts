import { getInboundActor } from "../../../inbound/admin";
import { createInboundWebhook, inboundWebhookInputSchema } from "../../../inbound/config";

export default defineEventHandler(async (event) => {
  const actor = await getInboundActor(event);
  const input = await readValidatedBody(event, inboundWebhookInputSchema.parse);
  try {
    return await createInboundWebhook(actor.email, input);
  } catch (error) {
    throw createError({ statusCode: 400, message: error instanceof Error ? error.message : "Could not create webhook" });
  }
});
