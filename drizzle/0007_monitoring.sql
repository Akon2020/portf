CREATE TYPE "public"."ban_source" AS ENUM('auto', 'manual');--> statement-breakpoint
CREATE TYPE "public"."security_action" AS ENUM('logged', 'challenged', 'blocked', 'banned');--> statement-breakpoint
CREATE TYPE "public"."security_category" AS ENUM('path_scan', 'sqli', 'xss', 'path_traversal', 'cmd_injection', 'brute_force', 'rate_abuse', 'bad_bot', 'honeypot', 'forbidden_method', 'invalid_token', 'other');--> statement-breakpoint
CREATE TYPE "public"."security_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"visitor_hash" text NOT NULL,
	"path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats" (
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"dimension" text DEFAULT '' NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "daily_stats_day_metric_dimension_pk" PRIMARY KEY("day","metric","dimension")
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"digest" text,
	"method" text,
	"path" text,
	"route_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_or_cidr" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_bans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip_or_cidr" text NOT NULL,
	"reason" text NOT NULL,
	"source" "ban_source" NOT NULL,
	"rule_id" text,
	"banned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"created_by" uuid,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"lifted_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"external_id" text
);
--> statement-breakpoint
CREATE TABLE "ip_reputation" (
	"ip" text PRIMARY KEY NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"events_count" integer DEFAULT 0 NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bans_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"locale" text,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"device" text,
	"browser" text,
	"os" text,
	"visitor_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ip" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"query" text,
	"user_agent" text,
	"category" "security_category" NOT NULL,
	"rule_id" text NOT NULL,
	"severity" "security_severity" NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"payload_excerpt" text,
	"country" text,
	"action_taken" "security_action" DEFAULT 'logged' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ip_bans" ADD CONSTRAINT "ip_bans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_name_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "error_logs_created_idx" ON "error_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ip_allowlist_ip_idx" ON "ip_allowlist" USING btree ("ip_or_cidr");--> statement-breakpoint
CREATE INDEX "ip_bans_active_idx" ON "ip_bans" USING btree ("lifted_at","expires_at");--> statement-breakpoint
CREATE INDEX "ip_bans_ip_idx" ON "ip_bans" USING btree ("ip_or_cidr");--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_path_idx" ON "page_views" USING btree ("path","created_at");--> statement-breakpoint
CREATE INDEX "security_events_created_idx" ON "security_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_events_ip_idx" ON "security_events" USING btree ("ip","created_at");--> statement-breakpoint
CREATE INDEX "security_events_category_idx" ON "security_events" USING btree ("category","created_at");