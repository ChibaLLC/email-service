import { assertInboundDashboardAdmin, assertWebhookAccess, getInboundActor } from "../../../../inbound/admin";
import { getInboundWebhook, inboundWebhookInputSchema, updateInboundWebhook } from "../../../../inbound/config";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  const actor = await getInboundActor(event);
  const id = getRouterParam(event, "id") || "";
  const webhook = await getInboundWebhook(id);
  if (!webhook) throw createError({ statusCode: 404, message: "Webhook was not found" });
  assertWebhookAccess(actor, webhook.ownerEmail);
  const input = await readValidatedBody(event, inboundWebhookInputSchema.parse);
  if (actor.email !== webhook.ownerEmail && (input.url || input.secret)) {
    throw createError({ statusCode: 403, message: "Only the webhook owner may change its URL or secret" });
  }
  try {
    await updateInboundWebhook(id, input);
    return { saved: true };
  } catch (error) {
    throw createError({ statusCode: 400, message: error instanceof Error ? error.message : "Could not update webhook" });
  }
});
