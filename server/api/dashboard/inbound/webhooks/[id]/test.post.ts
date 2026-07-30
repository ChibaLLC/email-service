import { assertWebhookCredentialsOwner, getInboundActor } from "../../../../../inbound/admin";
import { getInboundWebhook } from "../../../../../inbound/config";
import { verifyInboundWebhook } from "../../../../../inbound/service";

export default defineEventHandler(async (event) => {
  const actor = await getInboundActor(event);
  const id = getRouterParam(event, "id") || "";
  const webhook = await getInboundWebhook(id);
  if (!webhook) throw createError({ statusCode: 404, message: "Webhook was not found" });
  assertWebhookCredentialsOwner(actor.email, webhook.ownerEmail);
  try {
    const body: { previewOnly?: boolean } = (await readBody<{ previewOnly?: boolean }>(event).catch(() => ({}))) || {};
    return await verifyInboundWebhook(webhook, Boolean(body.previewOnly));
  } catch (error) {
    throw createError({
      statusCode: 502,
      message: error instanceof Error ? error.message : "Could not reach the webhook destination",
    });
  }
});
