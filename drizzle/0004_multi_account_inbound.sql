CREATE TABLE "inbound_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 993 NOT NULL,
	"secure" boolean DEFAULT true NOT NULL,
	"username_encrypted" text NOT NULL,
	"password_encrypted" text NOT NULL,
	"poll_interval_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_accounts_name_unique" ON "inbound_accounts" USING btree ("name");
--> statement-breakpoint
CREATE TABLE "inbound_mailboxes" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbound_mailboxes" ADD CONSTRAINT "inbound_mailboxes_account_id_inbound_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."inbound_accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_mailboxes_account_name_unique" ON "inbound_mailboxes" USING btree ("account_id", "name");
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_mailboxes_account_path_unique" ON "inbound_mailboxes" USING btree ("account_id", "path");
--> statement-breakpoint
INSERT INTO "inbound_accounts" ("id", "name", "enabled", "host", "port", "secure", "username_encrypted", "password_encrypted", "poll_interval_seconds", "created_at", "updated_at")
SELECT 'legacy', 'Default', "enabled", "host", "port", "secure", "username_encrypted", "password_encrypted", "poll_interval_seconds", "created_at", "updated_at"
FROM "inbound_config"
WHERE "host" IS NOT NULL AND "username_encrypted" IS NOT NULL AND "password_encrypted" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "inbound_mailboxes" ("id", "account_id", "name", "path", "enabled")
SELECT 'legacy', 'legacy', "mailbox", "mailbox", true
FROM "inbound_config"
WHERE EXISTS (SELECT 1 FROM "inbound_accounts" WHERE "id" = 'legacy')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "inbound_webhooks" ADD COLUMN "owner_email" text;
--> statement-breakpoint
UPDATE "inbound_webhooks"
SET "owner_email" = COALESCE(
	(SELECT "email" FROM "dashboard_members" WHERE "role" = 'owner' ORDER BY "created_at" LIMIT 1),
	(SELECT "email" FROM "dashboard_members" WHERE "role" = 'admin' ORDER BY "created_at" LIMIT 1),
	'legacy@local.invalid'
)
WHERE "owner_email" IS NULL;
--> statement-breakpoint
ALTER TABLE "inbound_webhooks" ALTER COLUMN "owner_email" SET NOT NULL;
--> statement-breakpoint
CREATE TABLE "inbound_webhook_subscriptions" (
	"webhook_id" text NOT NULL,
	"mailbox_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbound_webhook_subscriptions" ADD CONSTRAINT "inbound_webhook_subscriptions_webhook_id_inbound_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."inbound_webhooks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_subscriptions" ADD CONSTRAINT "inbound_webhook_subscriptions_mailbox_id_inbound_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."inbound_mailboxes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_webhook_subscriptions_unique" ON "inbound_webhook_subscriptions" USING btree ("webhook_id", "mailbox_id");
--> statement-breakpoint
INSERT INTO "inbound_webhook_subscriptions" ("webhook_id", "mailbox_id")
SELECT "id", 'legacy' FROM "inbound_webhooks"
WHERE EXISTS (SELECT 1 FROM "inbound_mailboxes" WHERE "id" = 'legacy')
ON CONFLICT ("webhook_id", "mailbox_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD COLUMN "account_id" text;
--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD COLUMN "account_name" text;
--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD COLUMN "mailbox_id" text;
--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD COLUMN "mailbox_name" text;
--> statement-breakpoint
UPDATE "inbound_messages"
SET "account_id" = 'legacy', "account_name" = 'Default', "mailbox_id" = 'legacy', "mailbox_name" = "mailbox"
WHERE EXISTS (SELECT 1 FROM "inbound_mailboxes" WHERE "id" = 'legacy')
	AND "mailbox" = (SELECT "mailbox" FROM "inbound_config" WHERE "id" = 'primary');
--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_account_id_inbound_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."inbound_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inbound_messages" ADD CONSTRAINT "inbound_messages_mailbox_id_inbound_mailboxes_id_fk" FOREIGN KEY ("mailbox_id") REFERENCES "public"."inbound_mailboxes"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE "inbound_runtime_state" SET "id" = 'legacy' WHERE "id" = 'primary' AND EXISTS (SELECT 1 FROM "inbound_mailboxes" WHERE "id" = 'legacy');
