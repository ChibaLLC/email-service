export interface EmailMessage {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
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
