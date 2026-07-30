export type InboundConfigSource = "environment" | "database";

export interface InboundConfig {
  enabled: true;
  source: InboundConfigSource;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  mailbox: string;
  webhookUrl: string;
  webhookSecret: string;
  pollIntervalSeconds: number;
}

export interface InboundConfigInput {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  mailbox: string;
  webhookUrl: string;
  webhookSecret?: string;
  pollIntervalSeconds: number;
}

export interface InboundWebhookPayload {
  type: "email.received";
  version: 1;
  id: string;
  occurredAt: string;
  email: {
    from: string | null;
    to: string | null;
    messageId: string | null;
    mailbox: string;
    uidValidity: string;
    uid: number;
    rawMimeBase64: string;
    rawSize: number;
    receivedAt: string | null;
  };
}
