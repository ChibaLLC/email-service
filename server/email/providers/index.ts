import type { EmailProvider } from "../types";
import { NodemailerProvider } from "./nodemailer";

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;

  const providerName = process.env.EMAIL_PROVIDER || "nodemailer";

  switch (providerName) {
    case "nodemailer":
      _provider = new NodemailerProvider();
      break;
    // Add new providers here:
    // case "resend":
    //   _provider = new ResendProvider();
    //   break;
    // case "sendgrid":
    //   _provider = new SendGridProvider();
    //   break;
    default:
      throw new Error(`Unknown email provider: ${providerName}. Supported: nodemailer`);
  }

  return _provider;
}
