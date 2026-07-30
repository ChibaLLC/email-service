CREATE TABLE "inbound_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"secret_encrypted" text NOT NULL,
	"sender_filters" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inbound_webhooks_created_at_idx" ON "inbound_webhooks" USING btree ("created_at");
--> statement-breakpoint
INSERT INTO "inbound_webhooks" ("id", "name", "url", "secret_encrypted")
SELECT 'legacy', 'Default', "webhook_url", "webhook_secret_encrypted"
FROM "inbound_config"
WHERE "webhook_url" IS NOT NULL AND "webhook_secret_encrypted" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_deliveries" ADD COLUMN "webhook_id" text;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_deliveries" ADD COLUMN "webhook_name" text;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_deliveries" ADD COLUMN "webhook_url" text;
--> statement-breakpoint
ALTER TABLE "inbound_webhook_deliveries" ADD COLUMN "webhook_secret_encrypted" text;
--> statement-breakpoint
UPDATE "inbound_webhook_deliveries" AS delivery
SET "webhook_id" = 'legacy',
	"webhook_name" = webhook."name",
	"webhook_url" = webhook."url",
	"webhook_secret_encrypted" = webhook."secret_encrypted"
FROM "inbound_webhooks" AS webhook
WHERE delivery."webhook_id" IS NULL AND webhook."id" = 'legacy';
--> statement-breakpoint
DROP INDEX "inbound_webhook_deliveries_message_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_webhook_deliveries_message_webhook_unique" ON "inbound_webhook_deliveries" USING btree ("message_id", "webhook_id");
