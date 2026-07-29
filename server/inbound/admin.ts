import { env } from "std-env";
import type { H3Event } from "h3";

export function assertInboundDashboardAdmin(event: H3Event) {
  const admins = (env.DASHBOARD_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (admins.length === 0) {
    throw createError({
      statusCode: 503,
      message: "DASHBOARD_ADMIN_EMAILS must be configured to manage inbound email settings.",
    });
  }

  const context = event.context as { dashboardUser?: { email?: string } };
  const email = context.dashboardUser?.email?.trim().toLowerCase();
  if (!email || !admins.includes(email)) {
    throw createError({ statusCode: 403, message: "Inbound email settings require dashboard administrator access." });
  }
}
