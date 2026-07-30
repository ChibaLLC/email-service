CREATE TYPE "public"."dashboard_member_role" AS ENUM('owner', 'admin', 'operator', 'viewer');
--> statement-breakpoint
CREATE TABLE "dashboard_access_settings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"login_domains" text[] DEFAULT '{}' NOT NULL,
	"api_key_domains" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_access_settings_singleton_check" CHECK ("id" = 'primary')
);
--> statement-breakpoint
CREATE TABLE "dashboard_members" (
	"email" text PRIMARY KEY NOT NULL,
	"role" "dashboard_member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"integration" varchar(64) PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"base_url" text,
	"username" text,
	"password_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_email" text NOT NULL,
	"action" varchar(100) NOT NULL,
	"target" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "settings_audit_events_created_at_idx" ON "settings_audit_events" USING btree ("created_at");
