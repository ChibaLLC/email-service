import { env } from "std-env";
import { getListmonkSettingsView } from "../../listmonk/config";
import { assertDashboardAdmin } from "../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardAdmin(event);
  return {
    emailProvider: env.EMAIL_PROVIDER || null,
    outbound: {
      smtpConfigured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
      resendConfigured: Boolean(env.RESEND_API_KEY),
      sendgridConfigured: Boolean(env.SENDGRID_API_KEY),
      mailchimpConfigured: Boolean(env.MAILCHIMP_TRANSACTIONAL_API_KEY),
      postalConfigured: Boolean(env.POSTAL_API_URL && env.POSTAL_SERVER_API_KEY),
    },
    settingsEncryptionConfigured: Boolean(env.SETTINGS_ENCRYPTION_KEY),
    listmonk: await getListmonkSettingsView(),
  };
});
