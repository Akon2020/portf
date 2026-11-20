import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import {
  journeyItems,
  media,
  projectImages,
  projects,
  services,
  skills,
  socialLinks,
  stats,
  testimonials,
} from "../db/schema";
import type { LibraryItem } from "@/components/admin/media-picker";

/** Media library for pickers, newest first. */
export async function listLibrary(): Promise<LibraryItem[]> {
  const rows = await getDb().select().from(media).where(isNull(media.deletedAt)).orderBy(desc(media.createdAt));
  return rows.map((row) => ({
    id: row.id,
    url: `/media/${row.path}`,
    thumb: `/media/${row.variants[0]?.path ?? row.path}`,
    mime: row.mime,
    alt: row.alt,
    needsReplacement: row.needsReplacement,
  }));
}

export async function listProjectsAdmin() {
  return getDb()
    .select()
    .from(projects)
    .where(isNull(projects.deletedAt))
    .orderBy(asc(projects.sortOrder), desc(projects.updatedAt));
}

export async function getProjectAdmin(id: string) {
  const db = getDb();
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);
  if (!project) return null;
  const gallery = await db
    .select({ mediaId: projectImages.mediaId })
    .from(projectImages)
    .where(eq(projectImages.projectId, id))
    .orderBy(asc(projectImages.sortOrder));
  return { project, galleryIds: gallery.map((row) => row.mediaId) };
}

export const ADMIN_LISTS = {
  parcours: () =>
    getDb().select().from(journeyItems).where(isNull(journeyItems.deletedAt)).orderBy(asc(journeyItems.sortOrder), desc(journeyItems.startDate)),
  competences: () => getDb().select().from(skills).orderBy(asc(skills.group), asc(skills.sortOrder)),
  services: () => getDb().select().from(services).orderBy(asc(services.sortOrder)),
  temoignages: () => getDb().select().from(testimonials).orderBy(asc(testimonials.sortOrder)),
  chiffres: () => getDb().select().from(stats).orderBy(asc(stats.sortOrder)),
  reseaux: () => getDb().select().from(socialLinks).orderBy(asc(socialLinks.sortOrder)),
};

const TABLES = {
  parcours: journeyItems,
  competences: skills,
  services,
  temoignages: testimonials,
  chiffres: stats,
  reseaux: socialLinks,
} as const;

export async function getEntityAdmin(route: keyof typeof TABLES, id: string) {
  const table = TABLES[route];
  const [row] = await getDb().select().from(table).where(eq(table.id, id)).limit(1);
  return row ?? null;
}

export async function contentCounts() {
  const db = getDb();
  const [[p], [j], [s], [sv], [t], [st], [so], [m]] = await Promise.all([
    db.select({ total: count() }).from(projects).where(isNull(projects.deletedAt)),
    db.select({ total: count() }).from(journeyItems).where(isNull(journeyItems.deletedAt)),
    db.select({ total: count() }).from(skills),
    db.select({ total: count() }).from(services),
    db.select({ total: count() }).from(testimonials),
    db.select({ total: count() }).from(stats),
    db.select({ total: count() }).from(socialLinks),
    db.select({ total: count() }).from(media).where(isNull(media.deletedAt)),
  ]);
  return {
    projets: p.total,
    parcours: j.total,
    competences: s.total,
    services: sv.total,
    temoignages: t.total,
    chiffres: st.total,
    reseaux: so.total,
    medias: m.total,
  };
}

/** Everything flagged "to review", for the review page and the dashboard. */
export async function reviewQueue() {
  const db = getDb();
  const [projectRows, journeyRows, testimonialRows, mediaRows] = await Promise.all([
    db
      .select({ id: projects.id, title: projects.title, note: projects.reviewNote, status: projects.status })
      .from(projects)
      .where(and(eq(projects.needsReview, true), isNull(projects.deletedAt)))
      .orderBy(asc(projects.sortOrder)),
    db
      .select({ id: journeyItems.id, title: journeyItems.title, organization: journeyItems.organization, note: journeyItems.reviewNote, status: journeyItems.status })
      .from(journeyItems)
      .where(and(eq(journeyItems.needsReview, true), isNull(journeyItems.deletedAt))),
    db
      .select({ id: testimonials.id, author: testimonials.authorCompany, quote: testimonials.quote, note: testimonials.reviewNote, status: testimonials.status })
      .from(testimonials)
      .where(eq(testimonials.needsReview, true)),
    db
      .select({ id: media.id, alt: media.alt, path: media.path, variants: media.variants })
      .from(media)
      .where(and(eq(media.needsReplacement, true), isNull(media.deletedAt))),
  ]);
  return { projects: projectRows, journey: journeyRows, testimonials: testimonialRows, media: mediaRows };
}
