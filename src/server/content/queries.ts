import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { getDb } from "../db";
import {
  journeyItems,
  media,
  projectImages,
  projects,
  services,
  settings,
  skills,
  socialLinks,
  stats,
  testimonials,
  type LocalizedText,
  type Media,
} from "../db/schema";
import { DEFAULT_SETTINGS, SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "./settings-schema";

/** Cache tags, invalidated by the admin after each change. */
export const TAGS = {
  settings: "content:settings",
  projects: "content:projects",
  journey: "content:journey",
  skills: "content:skills",
  services: "content:services",
  testimonials: "content:testimonials",
  socials: "content:socials",
  stats: "content:stats",
  media: "content:media",
} as const;

const ONE_DAY = 86_400;

export interface PublicMedia {
  id: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  alt: LocalizedText;
  blurDataUrl: string | null;
  srcSet: { url: string; width: number }[];
  needsReplacement: boolean;
}

export function toPublicMedia(row: Media | null | undefined): PublicMedia | null {
  if (!row || row.deletedAt) return null;
  return {
    id: row.id,
    url: `/media/${row.path}`,
    mime: row.mime,
    width: row.width,
    height: row.height,
    alt: row.alt,
    blurDataUrl: row.blurDataUrl,
    srcSet: row.variants.map((variant) => ({ url: `/media/${variant.path}`, width: variant.width })),
    needsReplacement: row.needsReplacement,
  };
}

async function loadMediaMap(ids: (string | null | undefined)[]): Promise<Map<string, PublicMedia>> {
  const unique = [...new Set(ids.filter((value): value is string => !!value))];
  if (unique.length === 0) return new Map();
  const rows = await getDb().select().from(media).where(inArray(media.id, unique));
  return new Map(rows.map((row) => [row.id, toPublicMedia(row)!]).filter(([, value]) => value) as [string, PublicMedia][]);
}

// Settings

async function readSetting<K extends SettingsKey>(key: K): Promise<SettingsValue<K>> {
  const [row] = await getDb().select().from(settings).where(eq(settings.key, key)).limit(1);
  const merged = { ...DEFAULT_SETTINGS[key], ...((row?.value as object | undefined) ?? {}) };
  const parsed = SETTINGS_SCHEMAS[key].safeParse(merged);
  return (parsed.success ? parsed.data : DEFAULT_SETTINGS[key]) as SettingsValue<K>;
}

export const getSetting = unstable_cache(readSetting, ["setting"], { tags: [TAGS.settings], revalidate: ONE_DAY }) as <
  K extends SettingsKey,
>(
  key: K,
) => Promise<SettingsValue<K>>;

export const getMediaById = unstable_cache(
  async (id: string | null) => (id ? ((await loadMediaMap([id])).get(id) ?? null) : null),
  ["media-by-id"],
  { tags: [TAGS.media], revalidate: ONE_DAY },
);

// Projects

const publishedProject = and(eq(projects.status, "published"), isNull(projects.deletedAt));

export type PublicProject = Omit<typeof projects.$inferSelect, "createdAt" | "updatedAt" | "deletedAt" | "publishedAt"> & {
  cover: PublicMedia | null;
  publishedAt: string | null;
};

function toPublicProject(row: typeof projects.$inferSelect, cover: PublicMedia | null): PublicProject {
  const { createdAt: _c, updatedAt: _u, deletedAt: _d, publishedAt, ...rest } = row;
  const project = { ...rest, cover, publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null };
  // Confidential client projects never expose the client name publicly.
  if (project.confidential) project.clientName = null;
  return project;
}

export const getPublishedProjects = unstable_cache(
  async (): Promise<PublicProject[]> => {
    const rows = await getDb()
      .select()
      .from(projects)
      .where(publishedProject)
      .orderBy(desc(projects.isFeatured), asc(projects.sortOrder), desc(projects.startedAt));
    const covers = await loadMediaMap(rows.map((row) => row.coverImageId));
    return rows.map((row) => toPublicProject(row, row.coverImageId ? (covers.get(row.coverImageId) ?? null) : null));
  },
  ["published-projects"],
  { tags: [TAGS.projects, TAGS.media], revalidate: ONE_DAY },
);

export interface ProjectDetail {
  project: PublicProject;
  gallery: { media: PublicMedia; caption: LocalizedText }[];
  testimonial: PublicTestimonial | null;
  previous: { slug: string; title: LocalizedText } | null;
  next: { slug: string; title: LocalizedText } | null;
}

export const getProjectDetail = unstable_cache(
  async (slug: string): Promise<ProjectDetail | null> => {
    const all = await getPublishedProjects();
    const index = all.findIndex((project) => project.slug === slug);
    if (index < 0) return null;
    const project = all[index];
    const db = getDb();
    const images = await db
      .select()
      .from(projectImages)
      .where(eq(projectImages.projectId, project.id))
      .orderBy(asc(projectImages.sortOrder));
    const mediaMap = await loadMediaMap(images.map((image) => image.mediaId));
    const [quote] = await db
      .select()
      .from(testimonials)
      .where(and(eq(testimonials.projectId, project.id), eq(testimonials.status, "approved")))
      .limit(1);
    const neighbour = (offset: number) => {
      const other = all[(index + offset + all.length) % all.length];
      return all.length > 1 && other ? { slug: other.slug, title: other.title } : null;
    };
    return {
      project,
      gallery: images
        .map((image) => ({ media: mediaMap.get(image.mediaId)!, caption: image.caption }))
        .filter((item) => item.media),
      testimonial: quote ? await toPublicTestimonial(quote) : null,
      previous: neighbour(-1),
      next: neighbour(1),
    };
  },
  ["project-detail"],
  { tags: [TAGS.projects, TAGS.media, TAGS.testimonials], revalidate: ONE_DAY },
);

// Journey, skills, services, stats, socials

export const getJourney = unstable_cache(
  async () =>
    getDb()
      .select({
        id: journeyItems.id,
        type: journeyItems.type,
        organization: journeyItems.organization,
        title: journeyItems.title,
        description: journeyItems.description,
        location: journeyItems.location,
        startDate: journeyItems.startDate,
        endDate: journeyItems.endDate,
        url: journeyItems.url,
        highlights: journeyItems.highlights,
      })
      .from(journeyItems)
      .where(and(eq(journeyItems.status, "published"), isNull(journeyItems.deletedAt)))
      .orderBy(asc(journeyItems.sortOrder), desc(journeyItems.startDate)),
  ["journey"],
  { tags: [TAGS.journey], revalidate: ONE_DAY },
);

export const getSkills = unstable_cache(
  async () =>
    getDb()
      .select({ id: skills.id, name: skills.name, group: skills.group, level: skills.level })
      .from(skills)
      .where(eq(skills.isVisible, true))
      .orderBy(asc(skills.sortOrder), asc(skills.name)),
  ["skills"],
  { tags: [TAGS.skills], revalidate: ONE_DAY },
);

export const getServices = unstable_cache(
  async () =>
    getDb()
      .select({
        id: services.id,
        slug: services.slug,
        title: services.title,
        description: services.description,
        deliverables: services.deliverables,
        startingPrice: services.startingPrice,
        currency: services.currency,
        icon: services.icon,
      })
      .from(services)
      .where(eq(services.isVisible, true))
      .orderBy(asc(services.sortOrder)),
  ["services"],
  { tags: [TAGS.services], revalidate: ONE_DAY },
);

export const getStats = unstable_cache(
  async () =>
    getDb()
      .select({ id: stats.id, label: stats.label, value: stats.value, suffix: stats.suffix })
      .from(stats)
      .where(eq(stats.isVisible, true))
      .orderBy(asc(stats.sortOrder)),
  ["stats"],
  { tags: [TAGS.stats], revalidate: ONE_DAY },
);

export const getSocialLinks = unstable_cache(
  async () =>
    getDb()
      .select({ id: socialLinks.id, platform: socialLinks.platform, label: socialLinks.label, url: socialLinks.url, handle: socialLinks.handle })
      .from(socialLinks)
      .where(eq(socialLinks.isVisible, true))
      .orderBy(asc(socialLinks.sortOrder)),
  ["socials"],
  { tags: [TAGS.socials], revalidate: ONE_DAY },
);

// Testimonials

export interface PublicTestimonial {
  id: string;
  authorName: string;
  authorRole: LocalizedText;
  authorCompany: string | null;
  authorUrl: string | null;
  quote: LocalizedText;
  photo: PublicMedia | null;
}

async function toPublicTestimonial(row: typeof testimonials.$inferSelect): Promise<PublicTestimonial> {
  const photos = await loadMediaMap([row.authorPhotoId]);
  return {
    id: row.id,
    authorName: row.authorName,
    authorRole: row.authorRole,
    authorCompany: row.authorCompany,
    authorUrl: row.authorUrl,
    quote: row.quote,
    photo: row.authorPhotoId ? (photos.get(row.authorPhotoId) ?? null) : null,
  };
}

export const getApprovedTestimonials = unstable_cache(
  async (): Promise<PublicTestimonial[]> => {
    const rows = await getDb()
      .select()
      .from(testimonials)
      .where(eq(testimonials.status, "approved"))
      .orderBy(asc(testimonials.sortOrder));
    return Promise.all(rows.map(toPublicTestimonial));
  },
  ["testimonials"],
  { tags: [TAGS.testimonials, TAGS.media], revalidate: ONE_DAY },
);
