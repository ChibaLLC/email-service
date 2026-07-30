import type { H3Event } from "h3";
import { assertDashboardAdmin, getDashboardEmail, getDashboardRole, isAdminRole } from "../settings/policy";

export async function assertInboundDashboardAdmin(event: H3Event) {
  return assertDashboardAdmin(event);
}

export async function getInboundActor(event: H3Event) {
  const email = getDashboardEmail(event);
  const { role } = await getDashboardRole(email);
  return { email, role, canModerate: isAdminRole(role) };
}

export function canManageWebhook(actor: { email: string; canModerate: boolean }, ownerEmail: string): boolean {
  return actor.email === ownerEmail || actor.canModerate;
}

export function canAccessWebhookCredentials(actorEmail: string, ownerEmail: string): boolean {
  return actorEmail === ownerEmail;
}

export function assertWebhookAccess(actor: { email: string; canModerate: boolean }, ownerEmail: string) {
  if (!canManageWebhook(actor, ownerEmail)) {
    throw createError({ statusCode: 403, message: "You may only manage your own webhooks" });
  }
}

export function assertWebhookCredentialsOwner(actorEmail: string, ownerEmail: string) {
  if (!canAccessWebhookCredentials(actorEmail, ownerEmail)) {
    throw createError({ statusCode: 403, message: "Only the webhook owner may access or test its credentials" });
  }
}
