import { render } from "@vue-email/render";
import { eq } from "drizzle-orm";
import { db, schema } from "../../database";
import { getDefaultFromAddress } from "../../email/config";
import { getActiveOutboundSettings } from "../../email/settings";
import TestEmail from "../../emails/TestEmail.vue";
import { addEmailJob } from "../../queue/email.queue";

export default defineEventHandler(async (event) => {
  const dashboardUser = event.context.dashboardUser as { email?: string } | undefined;

  if (!dashboardUser?.email) {
    throw createError({
      statusCode: 401,
      message: "Authentication required. Please log in again.",
    });
  }

  const outbound = await getActiveOutboundSettings();
  const provider = outbound.config.EMAIL_PROVIDER;
  const from = getDefaultFromAddress(outbound.config);
  const sentAt = new Date().toISOString();
  const subject = `Email service test via ${provider}`;
  const html = await render(TestEmail, {
    email: dashboardUser.email,
    provider,
    sentAt,
  });

  const [emailRecord] = await db
    .insert(schema.emails)
    .values({
      from,
      to: dashboardUser.email,
      subject,
      bodyType: "html",
      status: "queued",
      provider,
      outboundSettingsId: outbound.id,
    })
    .returning();

  try {
    await addEmailJob({
      emailId: emailRecord!.id,
      outboundSettingsId: outbound.id,
      from,
      to: dashboardUser.email,
      subject,
      html,
    });
  } catch (error) {
    await db.update(schema.emails).set({ status: "failed", error: "Could not enqueue email" }).where(eq(schema.emails.id, emailRecord!.id));
    throw error;
  }

  return {
    success: true,
    provider,
    email: dashboardUser.email,
    message: `Queued a test email to ${dashboardUser.email}`,
  };
});
