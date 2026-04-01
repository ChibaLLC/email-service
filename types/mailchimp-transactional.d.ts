declare module "@mailchimp/mailchimp_transactional" {
  export interface MailchimpRecipient {
    email: string;
    type?: "to" | "cc" | "bcc";
  }

  export interface MailchimpAttachment {
    type: string;
    name: string;
    content: string;
  }

  export interface MailchimpSendResponseItem {
    _id?: string;
    status?: string;
    reject_reason?: string | null;
  }

  export interface MailchimpClient {
    messages: {
      send(body: {
        message: {
          from_email?: string;
          to: MailchimpRecipient[];
          subject: string;
          html?: string;
          text?: string;
          attachments?: MailchimpAttachment[];
        };
      }): Promise<MailchimpSendResponseItem[]>;
    };
    users: {
      ping(body?: Record<string, never>): Promise<unknown>;
    };
  }

  export default function mailchimpTransactional(apiKey: string): MailchimpClient;
}