import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { journeyItems, projectImages, projects, settings, testimonials } from "../db/schema";
import { DEFAULT_SETTINGS, type ProfileSettings } from "../content/settings-schema";
import { importRemoteMedia } from "../services/media";
import {
  PORTRAIT_ALT_URL,
  PORTRAIT_URL,
  SEED_BIO_LONG,
  SEED_JOURNEY,
  SEED_PROJECTS,
  SEED_TESTIMONIALS,
  SEED_VALUES,
} from "./content-data";

type Log = (message: string) => void;

async function tryImport(url: string, alt: { fr: string; en?: string }, needsReplacement: boolean, log: Log) {
  try {
    const row = await importRemoteMedia(url, { alt: { fr: alt.fr, en: alt.en ?? "" }, needsReplacement });
    return row.id;
  } catch (error) {
    log(`  image ignorée : ${(error as Error).message}`);
    return null;
  }
}

/** Imports the content of both sites. Existing rows (same slug or key) are left untouched. */
export async function seedContent(log: Log, options: { images: boolean }): Promise<void> {
  const db = getDb();

  // Profile: portrait, long bio and values, only when still at their defaults.
  const [profileRow] = await db.select().from(settings).where(eq(settings.key, "profile")).limit(1);
  const profile = { ...DEFAULT_SETTINGS.profile, ...((profileRow?.value as Partial<ProfileSettings>) ?? {}) };
  let changed = false;
  if (!profile.portraitMediaId && options.images) {
    profile.portraitMediaId = await tryImport(PORTRAIT_URL, { fr: "Portrait d'Isaac Akonkwa", en: "Portrait of Isaac Akonkwa" }, false, log);
    await tryImport(PORTRAIT_ALT_URL, { fr: "Isaac Akonkwa", en: "Isaac Akonkwa" }, false, log);
    changed = true;
  }
  if (!profile.bioLong.fr) {
    profile.bioLong = { fr: SEED_BIO_LONG.fr, en: SEED_BIO_LONG.en ?? "" };
    changed = true;
  }
  if (profile.values.length === 0) {
    profile.values = SEED_VALUES.map((value) => ({
      title: { fr: value.title.fr, en: value.title.en ?? "" },
      text: { fr: value.text.fr, en: value.text.en ?? "" },
    }));
    changed = true;
  }
  if (changed) {
    await db
      .insert(settings)
      .values({ key: "profile", value: profile })
      .onConflictDoUpdate({ target: settings.key, set: { value: profile } });
    log("profil : portrait, biographie et valeurs importés");
  }

  // Projects
  for (const [index, seed] of SEED_PROJECTS.entries()) {
    const [existing] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, seed.slug)).limit(1);
    if (existing) {
      log(`projet ${seed.slug} : déjà présent`);
      continue;
    }
    const coverImageId =
      options.images && seed.cover ? await tryImport(seed.cover.url, seed.cover.alt, seed.cover.needsReplacement, log) : null;
    const [created] = await db
      .insert(projects)
      .values({
        slug: seed.slug,
        title: seed.title,
        summary: seed.summary,
        problem: seed.problem ?? { fr: "" },
        objective: seed.objective ?? { fr: "" },
        role: seed.role ?? { fr: "" },
        results: seed.results ?? [],
        categories: seed.categories,
        techStack: seed.techStack,
        stage: seed.stage,
        projectType: seed.projectType,
        confidential: seed.confidential ?? false,
        coverImageId,
        demoUrl: seed.demoUrl ?? null,
        repoUrl: seed.repoUrl ?? null,
        isFeatured: seed.isFeatured ?? false,
        sortOrder: index,
        status: seed.status,
        publishedAt: seed.status === "published" ? new Date() : null,
        needsReview: true,
        reviewNote: seed.reviewNote,
      })
      .returning({ id: projects.id });
    if (options.images && seed.gallery) {
      let order = 0;
      for (const image of seed.gallery) {
        const mediaId = await tryImport(image.url, image.alt, image.needsReplacement, log);
        if (mediaId) {
          await db.insert(projectImages).values({ projectId: created.id, mediaId, caption: image.alt, sortOrder: order++ });
        }
      }
    }
    log(`projet ${seed.slug} : créé (${seed.status})`);
  }

  // Journey
  const existingJourney = await db.select({ organization: journeyItems.organization, startDate: journeyItems.startDate }).from(journeyItems);
  const knownJourney = new Set(existingJourney.map((item) => `${item.organization}:${item.startDate}`));
  for (const [index, item] of SEED_JOURNEY.entries()) {
    if (knownJourney.has(`${item.organization}:${item.startDate}`)) continue;
    const { key: _key, ...values } = item;
    await db.insert(journeyItems).values({ ...values, sortOrder: index, reviewNote: item.reviewNote ?? null });
  }
  log(`parcours : ${SEED_JOURNEY.length} éléments vérifiés`);

  // Testimonials, pending until authors give their name and consent.
  const existingQuotes = await db.select({ quote: testimonials.quote }).from(testimonials);
  const knownQuotes = new Set(existingQuotes.map((row) => row.quote.en ?? row.quote.fr));
  for (const [index, testimonial] of SEED_TESTIMONIALS.entries()) {
    if (knownQuotes.has(testimonial.quote.en)) continue;
    await db.insert(testimonials).values({
      ...testimonial,
      status: "pending",
      needsReview: true,
      reviewNote: "Témoignage anonyme de l'ancien site : obtenir le nom, le rôle, une photo et l'accord de l'auteur.",
      sortOrder: index,
    });
  }
  log(`témoignages : ${SEED_TESTIMONIALS.length} vérifiés (en attente)`);
}
