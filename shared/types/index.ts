export interface EmailAttachment {
  filename: string;
  content?: string;
  path?: string;
  contentType?: string;
  encoding?: string;
}

export interface EmailMessage {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  email: string;
  name: string | null;
  active: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface EmailRecord {
  id: string;
  from: string;
  to: string;
  subject: string;
  status: "queued" | "sending" | "sent" | "failed";
  provider: string | null;
  error: string | null;
  queuedAt: string;
  sentAt: string | null;
}

export interface DashboardStats {
  totals: {
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    total: number;
  };
  sentToday: number;
  sentThisWeek: number;
  activeKeys: number;
  dailyCounts: { date: string; sent: number; failed: number; total: number }[];
  successRate: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export type OutboundProviderName = "nodemailer" | "resend" | "sendgrid" | "mailchimp" | "postal";

export type OutboundSettingsInput =
  | { provider: "nodemailer"; defaultFrom: string; host: string; port: number; username: string; password?: string }
  | { provider: "resend"; defaultFrom?: string; apiKey?: string }
  | { provider: "sendgrid" | "mailchimp"; defaultFrom: string; apiKey?: string }
  | { provider: "postal"; defaultFrom: string; apiUrl: string; serverApiKey?: string };

export interface OutboundSettingsView {
  source: "database";
  configured: boolean;
  active: null | {
    id: string;
    version: number;
    provider: OutboundProviderName;
    config: Record<string, string | number | boolean | undefined>;
    createdAt: string;
    createdBy: string;
  };
}

export interface InboundEmailConfigView {
  source: "database";
  canManageAccounts: boolean;
  accounts: {
    id: string;
    name: string;
    enabled?: boolean;
    host?: string;
    port?: number;
    secure?: boolean;
    username?: string;
    hasPassword?: boolean;
    pollIntervalSeconds?: number;
    mailboxes: { id: string; name: string; path?: string; enabled?: boolean }[];
  }[];
  webhooks: {
    id: string;
    name: string;
    ownerEmail: string;
    owned: boolean;
    canManage: boolean;
    url?: string;
    hasSecret: boolean;
    senderFilters: string[];
    mailboxIds: string[];
  }[];
  status: {
    mailboxes: {
      accountId: string;
      accountName: string;
      mailboxId: string;
      mailboxName: string;
      uidValidity: string | null;
      lastUid: number;
      lastPollAt: string | null;
      lastSuccessAt: string | null;
      lastError: string | null;
    }[];
    pendingDeliveries: number;
    failedDeliveries: number;
  };
}
