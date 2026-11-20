CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('USD', 'CDF');--> statement-breakpoint
CREATE TYPE "public"."journey_type" AS ENUM('experience', 'education', 'community', 'speaking', 'award');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('concept', 'in_progress', 'completed', 'maintained');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('personal', 'client', 'team', 'academic');--> statement-breakpoint
CREATE TYPE "public"."skill_group" AS ENUM('frontend', 'backend', 'mobile', 'database', 'cloud', 'ai', 'security', 'tools');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('advanced', 'confirmed', 'intermediate');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('github', 'linkedin', 'x', 'instagram', 'facebook', 'whatsapp', 'email', 'calendly', 'youtube', 'tiktok', 'other');--> statement-breakpoint
CREATE TYPE "public"."testimonial_status" AS ENUM('pending', 'approved', 'hidden');--> statement-breakpoint
CREATE TABLE "journey_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "journey_type" NOT NULL,
	"organization" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"location" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"url" text,
	"logo_media_id" uuid,
	"highlights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"path" text NOT NULL,
	"original_name" text,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text,
	"alt" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"variants" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blur_data_url" text,
	"source_url" text,
	"needs_replacement" boolean DEFAULT false NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "media_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE TABLE "project_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"caption" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"summary" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"problem" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"objective" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"role" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"body" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tech_stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stage" "project_stage" DEFAULT 'completed' NOT NULL,
	"project_type" "project_type" DEFAULT 'personal' NOT NULL,
	"confidential" boolean DEFAULT false NOT NULL,
	"cover_image_id" uuid,
	"demo_url" text,
	"repo_url" text,
	"started_at" date,
	"ended_at" date,
	"client_name" text,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"seo_title" jsonb,
	"seo_description" jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"deliverables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starting_price" integer,
	"currency" "currency" DEFAULT 'USD' NOT NULL,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"group" "skill_group" NOT NULL,
	"level" "skill_level" NOT NULL,
	"icon_slug" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "social_platform" NOT NULL,
	"label" text NOT NULL,
	"url" text NOT NULL,
	"handle" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" jsonb NOT NULL,
	"value" text NOT NULL,
	"suffix" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "testimonials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_name" text NOT NULL,
	"author_role" jsonb DEFAULT '{"fr":""}'::jsonb NOT NULL,
	"author_company" text,
	"author_photo_id" uuid,
	"author_url" text,
	"quote" jsonb NOT NULL,
	"project_id" uuid,
	"status" "testimonial_status" DEFAULT 'pending' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journey_items" ADD CONSTRAINT "journey_items_logo_media_id_media_id_fk" FOREIGN KEY ("logo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_author_photo_id_media_id_fk" FOREIGN KEY ("author_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journey_items_status_idx" ON "journey_items" USING btree ("status","start_date");--> statement-breakpoint
CREATE INDEX "media_checksum_idx" ON "media" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "project_images_project_idx" ON "project_images" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "services_slug_idx" ON "services" USING btree ("slug");