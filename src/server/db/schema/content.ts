import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, deletedAt, id, timestamptz, updatedAt } from "./columns";

/** Translatable text: French is required, English falls back to French when empty. */
export type LocalizedText = { fr: string; en?: string };

export const contentStatus = pgEnum("content_status", ["draft", "published", "archived"]);
export const projectStage = pgEnum("project_stage", ["concept", "in_progress", "completed", "maintained"]);
export const projectType = pgEnum("project_type", ["personal", "client", "team", "academic"]);
export const journeyType = pgEnum("journey_type", ["experience", "education", "community", "speaking", "award"]);
export const skillGroup = pgEnum("skill_group", [
  "frontend",
  "backend",
  "mobile",
  "database",
  "cloud",
  "ai",
  "security",
  "tools",
]);
export const skillLevel = pgEnum("skill_level", ["advanced", "confirmed", "intermediate"]);
export const testimonialStatus = pgEnum("testimonial_status", ["pending", "approved", "hidden"]);
export const socialPlatform = pgEnum("social_platform", [
  "github",
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "whatsapp",
  "email",
  "calendly",
  "youtube",
  "tiktok",
  "other",
]);
export const currency = pgEnum("currency", ["USD", "CDF"]);

export const PROJECT_CATEGORIES = [
  "web",
  "mobile",
  "ai",
  "security",
  "saas",
  "backend",
  "health",
  "education",
  "management",
  "devtools",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export type ProjectMetric = { label: LocalizedText; value: string };

export type MediaVariant = { width: number; height: number; path: string; size: number; mime: string };

export const media = pgTable(
  "media",
  {
    id: id(),
    path: text("path").notNull().unique(),
    originalName: text("original_name"),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum"),
    alt: jsonb("alt").$type<LocalizedText>().notNull().default({ fr: "" }),
    variants: jsonb("variants").$type<MediaVariant[]>().notNull().default([]),
    blurDataUrl: text("blur_data_url"),
    sourceUrl: text("source_url"),
    needsReplacement: boolean("needs_replacement").notNull().default(false),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [index("media_checksum_idx").on(table.checksum)],
);

const mediaRef = (name: string) => uuid(name).references(() => media.id, { onDelete: "set null" });

export const projects = pgTable(
  "projects",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    summary: jsonb("summary").$type<LocalizedText>().notNull().default({ fr: "" }),
    problem: jsonb("problem").$type<LocalizedText>().notNull().default({ fr: "" }),
    objective: jsonb("objective").$type<LocalizedText>().notNull().default({ fr: "" }),
    role: jsonb("role").$type<LocalizedText>().notNull().default({ fr: "" }),
    body: jsonb("body").$type<LocalizedText>().notNull().default({ fr: "" }),
    results: jsonb("results").$type<ProjectMetric[]>().notNull().default([]),
    categories: jsonb("categories").$type<ProjectCategory[]>().notNull().default([]),
    techStack: jsonb("tech_stack").$type<string[]>().notNull().default([]),
    stage: projectStage("stage").notNull().default("completed"),
    projectType: projectType("project_type").notNull().default("personal"),
    confidential: boolean("confidential").notNull().default(false),
    coverImageId: mediaRef("cover_image_id"),
    demoUrl: text("demo_url"),
    repoUrl: text("repo_url"),
    startedAt: date("started_at", { mode: "string" }),
    endedAt: date("ended_at", { mode: "string" }),
    clientName: text("client_name"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    status: contentStatus("status").notNull().default("draft"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNote: text("review_note"),
    seoTitle: jsonb("seo_title").$type<LocalizedText>(),
    seoDescription: jsonb("seo_description").$type<LocalizedText>(),
    publishedAt: timestamptz("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [
    uniqueIndex("projects_slug_idx").on(table.slug),
    index("projects_status_idx").on(table.status, table.sortOrder),
  ],
);

export const projectImages = pgTable(
  "project_images",
  {
    id: id(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    caption: jsonb("caption").$type<LocalizedText>().notNull().default({ fr: "" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("project_images_project_idx").on(table.projectId, table.sortOrder)],
);

export const journeyItems = pgTable(
  "journey_items",
  {
    id: id(),
    type: journeyType("type").notNull(),
    organization: text("organization").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({ fr: "" }),
    location: text("location"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    url: text("url"),
    logoMediaId: mediaRef("logo_media_id"),
    highlights: jsonb("highlights").$type<LocalizedText[]>().notNull().default([]),
    sortOrder: integer("sort_order").notNull().default(0),
    status: contentStatus("status").notNull().default("draft"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [index("journey_items_status_idx").on(table.status, table.startDate)],
);

export const skills = pgTable("skills", {
  id: id(),
  name: text("name").notNull(),
  group: skillGroup("group").notNull(),
  level: skillLevel("level").notNull(),
  iconSlug: text("icon_slug"),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const services = pgTable(
  "services",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({ fr: "" }),
    deliverables: jsonb("deliverables").$type<LocalizedText[]>().notNull().default([]),
    startingPrice: integer("starting_price"),
    currency: currency("currency").notNull().default("USD"),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    isVisible: boolean("is_visible").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("services_slug_idx").on(table.slug)],
);

export const testimonials = pgTable("testimonials", {
  id: id(),
  authorName: text("author_name").notNull(),
  authorRole: jsonb("author_role").$type<LocalizedText>().notNull().default({ fr: "" }),
  authorCompany: text("author_company"),
  authorPhotoId: mediaRef("author_photo_id"),
  authorUrl: text("author_url"),
  quote: jsonb("quote").$type<LocalizedText>().notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: testimonialStatus("status").notNull().default("pending"),
  needsReview: boolean("needs_review").notNull().default(false),
  reviewNote: text("review_note"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const socialLinks = pgTable("social_links", {
  id: id(),
  platform: socialPlatform("platform").notNull(),
  label: text("label").notNull(),
  url: text("url").notNull(),
  handle: text("handle"),
  isVisible: boolean("is_visible").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const stats = pgTable("stats", {
  id: id(),
  label: jsonb("label").$type<LocalizedText>().notNull(),
  value: text("value").notNull(),
  suffix: text("suffix"),
  sortOrder: integer("sort_order").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type Project = typeof projects.$inferSelect;
export type JourneyItem = typeof journeyItems.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Testimonial = typeof testimonials.$inferSelect;
export type SocialLink = typeof socialLinks.$inferSelect;
export type Stat = typeof stats.$inferSelect;
export type Media = typeof media.$inferSelect;
