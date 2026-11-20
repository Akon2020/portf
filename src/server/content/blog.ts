import { and, asc, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { z } from "@/lib/zod";
import { getDb } from "../db";
import { galleryAlbums, galleryItems, media, posts, type LocalizedText, type RichDoc } from "../db/schema";
import { renderRichDoc } from "../rich-text/render";
import { writeAudit } from "../services/audit";
import { ContentError, invalidate, type Actor } from "./mutations";
import { TAGS, toPublicMedia, type PublicMedia } from "./queries";
import { localized, stringList } from "./schemas";

// Validation

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug trop court")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lettres minuscules, chiffres et tirets simples uniquement");

const richDoc = z
  .string()
  .default("")
  .transform((value, context): RichDoc | null => {
    if (!value.trim()) return null;
    try {
      const parsed = JSON.parse(value) as RichDoc;
      if (parsed?.type !== "doc") throw new Error("not a document");
      return parsed;
    } catch {
      context.addIssue({ code: "custom", message: "Contenu illisible" });
      return z.NEVER;
    }
  });

export const postInputSchema = z
  .object({
    slug,
    title: localized({ required: true, max: 200 }),
    excerpt: localized({ max: 400 }),
    content: z.object({ fr: richDoc, en: richDoc }),
    coverImageId: z
      .string()
      .trim()
      .transform((value) => value || null)
      .pipe(z.uuid().nullable()),
    category: z.string().trim().max(60).transform((value) => value || null),
    tags: stringList,
    status: z.enum(["draft", "scheduled", "published"]),
    publishedAt: z
      .string()
      .trim()
      .default("")
      .transform((value) => (value ? new Date(value) : null))
      .refine((value) => value === null || !Number.isNaN(value.getTime()), "Date invalide"),
    seoTitle: localized({ max: 120 }),
    seoDescription: localized({ max: 300 }),
    needsReview: z.boolean().default(false),
    reviewNote: z.string().trim().max(2000).transform((value) => value || null),
  })
  .superRefine((value, context) => {
    if (value.status === "scheduled" && (!value.publishedAt || value.publishedAt.getTime() <= Date.now())) {
      context.addIssue({ code: "custom", message: "Choisissez une date future pour programmer l'article", path: ["publishedAt"] });
    }
  });

export type PostInput = z.infer<typeof postInputSchema>;

// Writing

export async function savePost(id: string | null, input: PostInput, actor: Actor): Promise<string> {
  const db = getDb();
  const [clash] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.slug, input.slug), id ? ne(posts.id, id) : sql`true`))
    .limit(1);
  if (clash) throw new ContentError("Ce slug est déjà utilisé par un autre article.", "slug");

  const [fr, en] = await Promise.all([renderRichDoc(input.content.fr), renderRichDoc(input.content.en)]);
  const publishedAt = input.status === "draft" ? input.publishedAt : (input.publishedAt ?? new Date());
  const values = {
    slug: input.slug,
    title: input.title,
    excerpt: input.excerpt,
    contentJson: { ...(input.content.fr ? { fr: input.content.fr } : {}), ...(input.content.en ? { en: input.content.en } : {}) },
    contentHtml: { fr: fr.html, en: en.html },
    toc: { fr: fr.toc, en: en.toc },
    readingMinutes: { fr: fr.readingMinutes, en: en.readingMinutes },
    coverImageId: input.coverImageId,
    category: input.category,
    tags: input.tags,
    status: input.status,
    publishedAt,
    seoTitle: input.seoTitle,
    seoDescription: input.seoDescription,
    needsReview: input.needsReview,
    reviewNote: input.reviewNote,
  };

  let postId = id;
  if (id) {
    const updated = await db.update(posts).set(values).where(eq(posts.id, id)).returning({ id: posts.id });
    if (updated.length === 0) throw new ContentError("Article introuvable.");
  } else {
    const [created] = await db.insert(posts).values({ ...values, authorId: actor.id }).returning({ id: posts.id });
    postId = created.id;
  }
  await writeAudit({
    actorId: actor.id,
    action: id ? "post.update" : "post.create",
    entityType: "post",
    entityId: postId!,
    diff: { status: input.status },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  invalidate(TAGS.posts);
  return postId!;
}

export async function deletePost(id: string, actor: Actor): Promise<void> {
  await getDb().update(posts).set({ deletedAt: new Date(), status: "draft" }).where(eq(posts.id, id));
  await writeAudit({ actorId: actor.id, action: "post.delete", entityType: "post", entityId: id, ip: actor.ip });
  invalidate(TAGS.posts);
}

// Public reading

/** Published, or scheduled with a date in the past: no cron needed to go live. */
const visiblePost: SQL = and(
  isNull(posts.deletedAt),
  or(eq(posts.status, "published"), and(eq(posts.status, "scheduled"), sql`${posts.publishedAt} <= now()`)),
)!;

const FIVE_MINUTES = 300;

export interface PostSummary {
  id: string;
  slug: string;
  title: LocalizedText;
  excerpt: LocalizedText;
  category: string | null;
  tags: string[];
  readingMinutes: { fr?: number; en?: number };
  publishedAt: string;
  cover: PublicMedia | null;
  hasEnglish: boolean;
}

export const getPublishedPosts = unstable_cache(
  async (): Promise<PostSummary[]> => {
    const rows = await getDb()
      .select({
        post: {
          id: posts.id,
          slug: posts.slug,
          title: posts.title,
          excerpt: posts.excerpt,
          category: posts.category,
          tags: posts.tags,
          readingMinutes: posts.readingMinutes,
          publishedAt: posts.publishedAt,
          contentHtml: posts.contentHtml,
        },
        cover: media,
      })
      .from(posts)
      .leftJoin(media, eq(media.id, posts.coverImageId))
      .where(visiblePost)
      .orderBy(desc(posts.publishedAt));
    return rows.map(({ post, cover }) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      tags: post.tags,
      readingMinutes: post.readingMinutes,
      publishedAt: (post.publishedAt ?? new Date()).toISOString(),
      cover: toPublicMedia(cover),
      hasEnglish: !!post.contentHtml.en,
    }));
  },
  ["published-posts"],
  { tags: [TAGS.posts, TAGS.media], revalidate: FIVE_MINUTES },
);

export const getPostBySlug = unstable_cache(
  async (postSlug: string) => {
    const [row] = await getDb()
      .select({ post: posts, cover: media })
      .from(posts)
      .leftJoin(media, eq(media.id, posts.coverImageId))
      .where(and(eq(posts.slug, postSlug), visiblePost))
      .limit(1);
    if (!row) return null;
    const { contentJson: _json, authorId: _author, deletedAt: _deleted, ...post } = row.post;
    return {
      ...post,
      publishedAt: (post.publishedAt ?? new Date()).toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      createdAt: post.createdAt.toISOString(),
      cover: toPublicMedia(row.cover),
    };
  },
  ["post-by-slug"],
  { tags: [TAGS.posts, TAGS.media], revalidate: FIVE_MINUTES },
);

/** Related posts: shared tags first, then same category, then most recent. */
export async function relatedPosts(current: { id: string; tags: string[]; category: string | null }, limit = 3): Promise<PostSummary[]> {
  const all = (await getPublishedPosts()).filter((post) => post.id !== current.id);
  const score = (post: PostSummary) =>
    post.tags.filter((tag) => current.tags.includes(tag)).length * 2 + (post.category && post.category === current.category ? 1 : 0);
  return all
    .map((post, index) => ({ post, score: score(post), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ post }) => post);
}

// Gallery

export const albumInputSchema = z.object({
  slug,
  title: localized({ required: true, max: 160 }),
  description: localized({ max: 2000 }),
  eventDate: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Date au format AAAA-MM-JJ")
    .transform((value) => value || null),
  location: z.string().trim().max(120).transform((value) => value || null),
  coverImageId: z
    .string()
    .trim()
    .transform((value) => value || null)
    .pipe(z.uuid().nullable()),
  status: z.enum(["draft", "published", "archived"]),
  sortOrder: z.coerce.number().int().min(-10_000).max(10_000).default(0),
  items: z
    .array(z.object({ mediaId: z.uuid(), caption: localized({ max: 300 }) }))
    .max(500)
    .default([]),
});

export type AlbumInput = z.infer<typeof albumInputSchema>;

export async function saveAlbum(id: string | null, input: AlbumInput, actor: Actor): Promise<string> {
  const db = getDb();
  const [clash] = await db
    .select({ id: galleryAlbums.id })
    .from(galleryAlbums)
    .where(and(eq(galleryAlbums.slug, input.slug), id ? ne(galleryAlbums.id, id) : sql`true`))
    .limit(1);
  if (clash) throw new ContentError("Ce slug est déjà utilisé par un autre album.", "slug");
  const { items, ...values } = input;
  const coverImageId = values.coverImageId ?? items[0]?.mediaId ?? null;

  const albumId = await db.transaction(async (tx) => {
    let current = id;
    if (id) {
      const updated = await tx.update(galleryAlbums).set({ ...values, coverImageId }).where(eq(galleryAlbums.id, id)).returning({ id: galleryAlbums.id });
      if (updated.length === 0) throw new ContentError("Album introuvable.");
    } else {
      const [created] = await tx.insert(galleryAlbums).values({ ...values, coverImageId }).returning({ id: galleryAlbums.id });
      current = created.id;
    }
    await tx.delete(galleryItems).where(eq(galleryItems.albumId, current!));
    if (items.length > 0) {
      await tx.insert(galleryItems).values(items.map((item, index) => ({ albumId: current!, mediaId: item.mediaId, caption: item.caption, sortOrder: index })));
    }
    return current!;
  });
  await writeAudit({ actorId: actor.id, action: id ? "album.update" : "album.create", entityType: "album", entityId: albumId, diff: { items: items.length }, ip: actor.ip });
  invalidate(TAGS.gallery);
  return albumId;
}

export async function deleteAlbum(id: string, actor: Actor): Promise<void> {
  await getDb().update(galleryAlbums).set({ deletedAt: new Date(), status: "archived" }).where(eq(galleryAlbums.id, id));
  await writeAudit({ actorId: actor.id, action: "album.delete", entityType: "album", entityId: id, ip: actor.ip });
  invalidate(TAGS.gallery);
}

const visibleAlbum = and(eq(galleryAlbums.status, "published"), isNull(galleryAlbums.deletedAt));

export interface PublicAlbum {
  id: string;
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  eventDate: string | null;
  location: string | null;
  cover: PublicMedia | null;
  count: number;
}

export const getPublishedAlbums = unstable_cache(
  async (): Promise<PublicAlbum[]> => {
    const db = getDb();
    const rows = await db
      .select({ album: galleryAlbums, cover: media })
      .from(galleryAlbums)
      .leftJoin(media, eq(media.id, galleryAlbums.coverImageId))
      .where(visibleAlbum)
      .orderBy(asc(galleryAlbums.sortOrder), desc(galleryAlbums.eventDate));
    const ids = rows.map((row) => row.album.id);
    const counts = ids.length
      ? await db
          .select({ albumId: galleryItems.albumId, total: sql<number>`count(*)::int` })
          .from(galleryItems)
          .where(inArray(galleryItems.albumId, ids))
          .groupBy(galleryItems.albumId)
      : [];
    const countMap = new Map(counts.map((row) => [row.albumId, row.total]));
    return rows.map(({ album, cover }) => ({
      id: album.id,
      slug: album.slug,
      title: album.title,
      description: album.description,
      eventDate: album.eventDate,
      location: album.location,
      cover: toPublicMedia(cover),
      count: countMap.get(album.id) ?? 0,
    }));
  },
  ["published-albums"],
  { tags: [TAGS.gallery, TAGS.media], revalidate: 86_400 },
);

export const getAlbumBySlug = unstable_cache(
  async (albumSlug: string) => {
    const db = getDb();
    const albums = await getPublishedAlbums();
    const album = albums.find((item) => item.slug === albumSlug);
    if (!album) return null;
    const rows = await db
      .select({ item: galleryItems, media })
      .from(galleryItems)
      .innerJoin(media, eq(media.id, galleryItems.mediaId))
      .where(eq(galleryItems.albumId, album.id))
      .orderBy(asc(galleryItems.sortOrder));
    return {
      album,
      items: rows
        .map(({ item, media: file }) => ({ id: item.id, caption: item.caption, media: toPublicMedia(file) }))
        .filter((item): item is { id: string; caption: LocalizedText; media: PublicMedia } => item.media !== null),
    };
  },
  ["album-by-slug"],
  { tags: [TAGS.gallery, TAGS.media], revalidate: 86_400 },
);

/** Latest images across published albums, for the home page preview. */
export const getLatestGalleryImages = unstable_cache(
  async (limit: number) => {
    const rows = await getDb()
      .select({ item: galleryItems, media, albumSlug: galleryAlbums.slug })
      .from(galleryItems)
      .innerJoin(galleryAlbums, eq(galleryAlbums.id, galleryItems.albumId))
      .innerJoin(media, eq(media.id, galleryItems.mediaId))
      .where(visibleAlbum)
      .orderBy(desc(galleryAlbums.eventDate), asc(galleryItems.sortOrder))
      .limit(limit);
    return rows
      .map(({ item, media: file, albumSlug }) => ({ id: item.id, caption: item.caption, albumSlug, media: toPublicMedia(file) }))
      .filter((item): item is { id: string; caption: LocalizedText; albumSlug: string; media: PublicMedia } => item.media !== null);
  },
  ["latest-gallery"],
  { tags: [TAGS.gallery, TAGS.media], revalidate: 86_400 },
);
