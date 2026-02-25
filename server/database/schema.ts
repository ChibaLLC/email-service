import { pgTable, text, timestamp, boolean, varchar, pgEnum } from "drizzle-orm/pg-core";
import { ulid } from "ulid";

export const emailStatusEnum = pgEnum("email_status", ["queued", "sending", "sent", "failed"]);

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
