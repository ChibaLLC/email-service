import type { EmailProvider } from "../types";
import type { EmailProviderConfig } from "../config";
import { MailchimpProvider } from "./mailchimp";
import { NodemailerProvider } from "./nodemailer";
import { PostalProvider } from "./postal";
import { ResendProvider } from "./resend";
import { SendGridProvider } from "./sendgrid";

export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  switch (config.EMAIL_PROVIDER) {
    case "nodemailer": return new NodemailerProvider(config);
    case "resend": return new ResendProvider(config);
    case "sendgrid": return new SendGridProvider(config);
    case "mailchimp": return new MailchimpProvider(config);
    case "postal": return new PostalProvider(config);
  }
}
