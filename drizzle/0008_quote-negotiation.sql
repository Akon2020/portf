CREATE TYPE "public"."negotiation_author" AS ENUM('client', 'admin');--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'negotiating';--> statement-breakpoint
ALTER TYPE "public"."quote_status" ADD VALUE 'revised';--> statement-breakpoint
CREATE TABLE "quote_negotiations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"author" "negotiation_author" NOT NULL,
	"author_name" text,
	"proposed_total" integer,
	"requested_features" text,
	"message" text NOT NULL,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "parent_quote_id" uuid;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_negotiations" ADD CONSTRAINT "quote_negotiations_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_negotiations_quote_idx" ON "quote_negotiations" USING btree ("quote_id","created_at");