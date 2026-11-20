import { boolean, date, index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { createdAt, deletedAt, id, timestamptz, updatedAt } from "./columns";
import { contentStatus, media, type LocalizedText } from "./content";

export const postStatus = pgEnum("post_status", ["draft", "scheduled", "published"]);

/** Tiptap (ProseMirror) document, stored as JSON. */
export type RichDoc = { type: "doc"; content?: unknown[] };
export type TocEntry = { id: string; text: string; level: number };
type PerLocale<T> = { fr?: T; en?: T };

export const posts = pgTable(
  "posts",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    excerpt: jsonb("excerpt").$type<LocalizedText>().notNull().default({ fr: "" }),
    /** Editor source per language. */
    contentJson: jsonb("content_json").$type<PerLocale<RichDoc>>().notNull().default({}),
    /** Sanitized and highlighted HTML per language, rendered at save time. */
    contentHtml: jsonb("content_html").$type<LocalizedText>().notNull().default({ fr: "" }),
    toc: jsonb("toc").$type<PerLocale<TocEntry[]>>().notNull().default({}),
    readingMinutes: jsonb("reading_minutes").$type<PerLocale<number>>().notNull().default({}),
    coverImageId: uuid("cover_image_id").references(() => media.id, { onDelete: "set null" }),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    status: postStatus("status").notNull().default("draft"),
    publishedAt: timestamptz("published_at"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    seoTitle: jsonb("seo_title").$type<LocalizedText>(),
    seoDescription: jsonb("seo_description").$type<LocalizedText>(),
    views: integer("views").notNull().default(0),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [uniqueIndex("posts_slug_idx").on(table.slug), index("posts_status_idx").on(table.status, table.publishedAt)],
);

export const galleryAlbums = pgTable(
  "gallery_albums",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: jsonb("title").$type<LocalizedText>().notNull(),
    description: jsonb("description").$type<LocalizedText>().notNull().default({ fr: "" }),
    eventDate: date("event_date", { mode: "string" }),
    location: text("location"),
    coverImageId: uuid("cover_image_id").references(() => media.id, { onDelete: "set null" }),
    status: contentStatus("status").notNull().default("draft"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (table) => [uniqueIndex("gallery_albums_slug_idx").on(table.slug)],
);

export const galleryItems = pgTable(
  "gallery_items",
  {
    id: id(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    caption: jsonb("caption").$type<LocalizedText>().notNull().default({ fr: "" }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("gallery_items_album_idx").on(table.albumId, table.sortOrder)],
);

export type Post = typeof posts.$inferSelect;
export type GalleryAlbum = typeof galleryAlbums.$inferSelect;
export type GalleryItem = typeof galleryItems.$inferSelect;
