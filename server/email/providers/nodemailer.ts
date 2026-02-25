import { createTransport, type Transporter } from "nodemailer";
import type { EmailProvider, EmailMessage, EmailResult } from "../types";

export class NodemailerProvider implements EmailProvider {
  readonly name = "nodemailer";
  private transporter: Transporter;

  constructor() {
    this.transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: parseInt(process.env.SMTP_PORT || "587") === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    try {
      const result = await this.transporter.sendMail({
        from: message.from || process.env.DEFAULT_FROM,
        to: Array.isArray(message.to) ? message.to.join(", ") : message.to,
        subject: message.subject,
        ...(message.html ? { html: message.html } : { text: message.text }),
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
