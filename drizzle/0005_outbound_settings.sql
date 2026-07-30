CREATE TABLE "outbound_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"provider" varchar(32) NOT NULL,
	"config" jsonb NOT NULL,
	"secrets_encrypted" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbound_settings_provider_check" CHECK ("provider" IN ('nodemailer', 'resend', 'sendgrid', 'mailchimp', 'postal'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_settings_version_unique" ON "outbound_settings" USING btree ("version");
--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_settings_one_active_unique" ON "outbound_settings" USING btree ("active") WHERE "active" = true;
--> statement-breakpoint
CREATE FUNCTION prevent_outbound_settings_mutation() RETURNS trigger AS $$
BEGIN
	IF TG_OP = 'DELETE' THEN
		RAISE EXCEPTION 'outbound settings versions cannot be deleted';
	END IF;
	IF NEW.id <> OLD.id OR NEW.version <> OLD.version OR NEW.provider <> OLD.provider OR NEW.config <> OLD.config OR NEW.secrets_encrypted <> OLD.secrets_encrypted OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
		RAISE EXCEPTION 'outbound settings versions are immutable';
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER outbound_settings_immutable BEFORE UPDATE OR DELETE ON "outbound_settings" FOR EACH ROW EXECUTE FUNCTION prevent_outbound_settings_mutation();
--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "outbound_settings_id" text;
--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_outbound_settings_id_outbound_settings_id_fk" FOREIGN KEY ("outbound_settings_id") REFERENCES "public"."outbound_settings"("id") ON DELETE restrict ON UPDATE no action;
