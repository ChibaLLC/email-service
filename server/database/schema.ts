import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { ulid } from "ulid";

export const emailStatusEnum = pgEnum("email_status", ["queued", "sending", "sent", "failed"]);
export const inboundDeliveryStatusEnum = pgEnum("inbound_delivery_status", ["pending", "delivered", "failed"]);
export const dashboardMemberRoleEnum = pgEnum("dashboard_member_role", ["owner", "admin", "operator", "viewer"]);

export const apiKeys = pgTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => ulid()),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
  email: text("email").notNull(),
  name: text("name"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export const emails = pgTable("emails", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => ulid()),
  apiKeyId: text("api_key_id").references(() => apiKeys.id),
  from: text("from").notNull(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  bodyType: varchar("body_type", { length: 10 }).notNull().default("text"),
  status: emailStatusEnum("status").notNull().default("queued"),
  provider: varchar("provider", { length: 50 }),
  providerId: text("provider_id"),
  error: text("error"),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const inboundConfig = pgTable("inbound_config", {
  id: varchar("id", { length: 32 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  host: text("host"),
  port: integer("port").notNull().default(993),
  secure: boolean("secure").notNull().default(true),
  usernameEncrypted: text("username_encrypted"),
  passwordEncrypted: text("password_encrypted"),
  mailbox: text("mailbox").notNull().default("INBOX"),
  webhookUrl: text("webhook_url"),
  webhookSecretEncrypted: text("webhook_secret_encrypted"),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(30),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inboundWebhooks = pgTable(
  "inbound_webhooks",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secretEncrypted: text("secret_encrypted").notNull(),
    senderFilters: text("sender_filters").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("inbound_webhooks_created_at_idx").on(table.createdAt)],
);

export const inboundRuntimeState = pgTable("inbound_runtime_state", {
  id: varchar("id", { length: 32 }).primaryKey(),
  accountFingerprint: text("account_fingerprint"),
  uidValidity: text("uid_validity"),
  lastUid: bigint("last_uid", { mode: "number" }).notNull().default(0),
  lastPollAt: timestamp("last_poll_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inboundMessages = pgTable(
  "inbound_messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => ulid()),
    accountFingerprint: text("account_fingerprint").notNull(),
    mailbox: text("mailbox").notNull(),
    uidValidity: text("uid_validity").notNull(),
    uid: bigint("uid", { mode: "number" }).notNull(),
    messageId: text("message_id"),
    from: text("from"),
    to: text("to"),
    rawEncrypted: text("raw_encrypted"),
    rawSize: integer("raw_size").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inbound_messages_account_uid_unique").on(
      table.accountFingerprint,
      table.mailbox,
      table.uidValidity,
      table.uid,
    ),
    index("inbound_messages_created_at_idx").on(table.createdAt),
  ],
);

export const inboundWebhookDeliveries = pgTable(
  "inbound_webhook_deliveries",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => ulid()),
    messageId: text("message_id")
      .notNull()
      .references(() => inboundMessages.id, { onDelete: "cascade" }),
    webhookId: text("webhook_id"),
    webhookName: text("webhook_name"),
    webhookUrl: text("webhook_url"),
    webhookSecretEncrypted: text("webhook_secret_encrypted"),
    status: inboundDeliveryStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    responseStatus: integer("response_status"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inbound_webhook_deliveries_message_webhook_unique").on(table.messageId, table.webhookId),
    index("inbound_webhook_deliveries_due_idx").on(table.status, table.nextAttemptAt),
  ],
);

export const dashboardAccessSettings = pgTable(
  "dashboard_access_settings",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    loginDomains: text("login_domains").array().notNull().default([]),
    apiKeyDomains: text("api_key_domains").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("dashboard_access_settings_singleton_check", sql`${table.id} = 'primary'`)],
);

export const dashboardMembers = pgTable("dashboard_members", {
  email: text("email").primaryKey(),
  role: dashboardMemberRoleEnum("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const integrationSettings = pgTable("integration_settings", {
  integration: varchar("integration", { length: 64 }).primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  baseUrl: text("base_url"),
  username: text("username"),
  passwordEncrypted: text("password_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settingsAuditEvents = pgTable(
  "settings_audit_events",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => ulid()),
    actorEmail: text("actor_email").notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    target: varchar("target", { length: 100 }).notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("settings_audit_events_created_at_idx").on(table.createdAt)],
);
