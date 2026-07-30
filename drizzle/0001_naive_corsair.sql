CREATE TYPE "public"."inbound_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "inbound_config" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"host" text,
	"port" integer DEFAULT 993 NOT NULL,
	"secure" boolean DEFAULT true NOT NULL,
	"username_encrypted" text,
	"password_encrypted" text,
	"mailbox" text DEFAULT 'INBOX' NOT NULL,
	"webhook_url" text,
	"webhook_secret_encrypted" text,
	"poll_interval_seconds" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"account_fingerprint" text NOT NULL,
	"mailbox" text NOT NULL,
	"uid_validity" text NOT NULL,
	"uid" bigint NOT NULL,
	"message_id" text,
	"from" text,
	"to" text,
	"raw_encrypted" text,
	"raw_size" integer NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_runtime_state" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"account_fingerprint" text,
	"uid_validity" text,
	"last_uid" bigint DEFAULT 0 NOT NULL,
	"last_poll_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"status" "inbound_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_status" integer,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbound_webhook_deliveries" ADD CONSTRAINT "inbound_webhook_deliveries_message_id_inbound_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."inbound_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_messages_account_uid_unique" ON "inbound_messages" USING btree ("account_fingerprint","mailbox","uid_validity","uid");--> statement-breakpoint
CREATE INDEX "inbound_messages_created_at_idx" ON "inbound_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_webhook_deliveries_message_unique" ON "inbound_webhook_deliveries" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "inbound_webhook_deliveries_due_idx" ON "inbound_webhook_deliveries" USING btree ("status","next_attempt_at");