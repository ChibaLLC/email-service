import { assertInboundDashboardAdmin, assertWebhookAccess, getInboundActor } from "../../../../inbound/admin";
import { deleteInboundWebhook, getInboundWebhook } from "../../../../inbound/config";

export default defineEventHandler(async (event) => {
  await assertInboundDashboardAdmin(event);
  const actor = await getInboundActor(event);
  const id = getRouterParam(event, "id") || "";
  const webhook = await getInboundWebhook(id);
  if (!webhook) throw createError({ statusCode: 404, message: "Webhook was not found" });
  assertWebhookAccess(actor, webhook.ownerEmail);
  await deleteInboundWebhook(id);
  return { deleted: true };
});
