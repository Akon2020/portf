CREATE TYPE "public"."post_status" AS ENUM('draft', 'scheduled', 'published');--> statement-breakpoint
CREATE TABLE "gallery_albums" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"event_date" date,
	"location" text,
	"cover_image_id" uuid,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gallery_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"album_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"excerpt" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_html" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"toc" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reading_minutes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cover_image_id" uuid,
	"category" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "post_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone,
	"author_id" uuid,
	"seo_title" jsonb,
	"seo_description" jsonb,
	"views" integer DEFAULT 0 NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "gallery_albums" ADD CONSTRAINT "gallery_albums_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_album_id_gallery_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."gallery_albums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_items" ADD CONSTRAINT "gallery_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gallery_albums_slug_idx" ON "gallery_albums" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "gallery_items_album_idx" ON "gallery_items" USING btree ("album_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" USING btree ("status","published_at");