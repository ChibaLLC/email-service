export type InboundConfigSource = "database";

export interface InboundWebhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  senderFilters: string[];
  ownerEmail: string;
  mailboxIds: string[];
}

export interface InboundMailboxConfig {
  id: string;
  name: string;
  path: string;
  webhooks: InboundWebhook[];
}

export interface InboundActor {
  email: string;
  canModerate: boolean;
}

export interface InboundAccountConfig {
  id: string;
  name: string;
  source: InboundConfigSource;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  mailboxes: InboundMailboxConfig[];
  pollIntervalSeconds: number;
}

export interface InboundAccountInput {
  id?: string;
  name: string;
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password?: string;
  mailboxes: {
    id?: string;
    name: string;
    path: string;
    enabled: boolean;
  }[];
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
    accountId: string | null;
    accountName: string | null;
    mailboxId: string | null;
    mailboxName: string | null;
    uidValidity: string;
    uid: number;
    rawMimeBase64: string;
    rawSize: number;
    receivedAt: string | null;
    calendarReply: import("./calendar-reply").InboundCalendarReply | null;
  };
}
