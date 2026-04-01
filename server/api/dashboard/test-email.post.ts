import { render } from "@vue-email/render";
import { db, schema } from "../../database";
import { getDefaultFromAddress, getSelectedEmailProviderName } from "../../email/config";
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

  const provider = getSelectedEmailProviderName();
  const from = getDefaultFromAddress();
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
    })
    .returning();

  await addEmailJob({
    emailId: emailRecord!.id,
    from,
    to: dashboardUser.email,
    subject,
    html,
  });

  return {
    success: true,
    provider,
    email: dashboardUser.email,
    message: `Queued a test email to ${dashboardUser.email}`,
  };
});