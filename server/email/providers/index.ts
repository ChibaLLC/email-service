import type { EmailProvider } from "../types";
import { getSelectedEmailProviderName } from "../config";
import { MailchimpProvider } from "./mailchimp";
import { NodemailerProvider } from "./nodemailer";
import { PostalProvider } from "./postal";
import { ResendProvider } from "./resend";
import { SendGridProvider } from "./sendgrid";

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;

  const providerName = getSelectedEmailProviderName();

  switch (providerName) {
    case "nodemailer":
      _provider = new NodemailerProvider();
      break;
    case "resend":
      _provider = new ResendProvider();
      break;
    case "sendgrid":
      _provider = new SendGridProvider();
      break;
    case "mailchimp":
      _provider = new MailchimpProvider();
      break;
    case "postal":
      _provider = new PostalProvider();
      break;
    // Add new providers here:
    default:
      throw new Error(`Unknown email provider: ${providerName}. Supported: nodemailer, resend, sendgrid, mailchimp, postal`);
  }

  return _provider;
}
