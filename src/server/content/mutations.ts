import { and, eq, ne, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { revalidateTag } from "next/cache";
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
  faqs,
  partners,
  stats,
  testimonials,
} from "../db/schema";
import { writeAudit } from "../services/audit";
import { TAGS } from "./queries";
import type {
  JourneyInput,
  ProjectInput,
  ServiceInput,
  SkillInput,
  SocialLinkInput,
  FaqInput,
  PartnerInput,
  StatInput,
  TestimonialInput,
} from "./schemas";
import { SETTINGS_SCHEMAS, type SettingsKey, type SettingsValue } from "./settings-schema";

export interface Actor {
  id: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export class ContentError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

/** Marks cached public data as expired. Outside a request (seed scripts) it is a no op. */
export function invalidate(...tags: string[]): void {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Not in a Next request context.
    }
  }
}

function changedKeys(before: Record<string, unknown> | undefined, after: Record<string, unknown>): string[] {
  if (!before) return Object.keys(after);
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

async function audit(actor: Actor, action: string, entityType: string, entityId: string, diff?: Record<string, unknown>) {
  await writeAudit({ actorId: actor.id, action, entityType, entityId, diff, ip: actor.ip, userAgent: actor.userAgent });
}

// Projects

export async function saveProject(id: string | null, input: ProjectInput, actor: Actor): Promise<string> {
  const db = getDb();
  const { galleryIds, ...values } = input;

  const [clash] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.slug, values.slug), id ? ne(projects.id, id) : sql`true`))
    .limit(1);
  if (clash) throw new ContentError("Ce slug est déjà utilisé par un autre projet.", "slug");

  return db.transaction(async (tx) => {
    let projectId = id;
    let before: Record<string, unknown> | undefined;
    if (id) {
      const [current] = await tx.select().from(projects).where(eq(projects.id, id)).limit(1);
      if (!current) throw new ContentError("Projet introuvable.");
      before = current;
      const publishedAt = values.status === "published" && !current.publishedAt ? new Date() : current.publishedAt;
      await tx.update(projects).set({ ...values, publishedAt }).where(eq(projects.id, id));
    } else {
      const [created] = await tx
        .insert(projects)
        .values({ ...values, publishedAt: values.status === "published" ? new Date() : null })
        .returning({ id: projects.id });
      projectId = created.id;
    }
    await tx.delete(projectImages).where(eq(projectImages.projectId, projectId!));
    if (galleryIds.length > 0) {
      await tx
        .insert(projectImages)
        .values(galleryIds.map((mediaId, index) => ({ projectId: projectId!, mediaId, sortOrder: index })));
    }
    await audit(actor, id ? "project.update" : "project.create", "project", projectId!, {
      changed: changedKeys(before, values as Record<string, unknown>),
      status: values.status,
    });
    invalidate(TAGS.projects);
    return projectId!;
  });
}

export async function deleteProject(id: string, actor: Actor): Promise<void> {
  await getDb().update(projects).set({ deletedAt: new Date(), status: "archived" }).where(eq(projects.id, id));
  await audit(actor, "project.delete", "project", id);
  invalidate(TAGS.projects);
}

export async function duplicateProject(id: string, actor: Actor): Promise<string> {
  const db = getDb();
  const [source] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!source) throw new ContentError("Projet introuvable.");
  const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, ...rest } = source;
  const [copy] = await db
    .insert(projects)
    .values({ ...rest, slug: `${source.slug}-copie-${Date.now().toString(36)}`, status: "draft", isFeatured: false })
    .returning({ id: projects.id });
  const images = await db.select().from(projectImages).where(eq(projectImages.projectId, id));
  if (images.length > 0) {
    await db.insert(projectImages).values(
      images.map(({ mediaId, caption, sortOrder }) => ({ projectId: copy.id, mediaId, caption, sortOrder })),
    );
  }
  await audit(actor, "project.duplicate", "project", copy.id, { from: id });
  return copy.id;
}

// Simple entities share the same create, update and delete logic.

interface SimpleEntity<TInput> {
  table: PgTable & { id: AnyPgColumn };
  tag: string;
  type: string;
  softDelete?: boolean;
  _input?: TInput;
}

const ENTITIES = {
  journey: { table: journeyItems, tag: TAGS.journey, type: "journey_item", softDelete: true } as SimpleEntity<JourneyInput>,
  skill: { table: skills, tag: TAGS.skills, type: "skill" } as SimpleEntity<SkillInput>,
  service: { table: services, tag: TAGS.services, type: "service" } as SimpleEntity<ServiceInput>,
  testimonial: { table: testimonials, tag: TAGS.testimonials, type: "testimonial" } as SimpleEntity<TestimonialInput>,
  stat: { table: stats, tag: TAGS.stats, type: "stat" } as SimpleEntity<StatInput>,
  social: { table: socialLinks, tag: TAGS.socials, type: "social_link" } as SimpleEntity<SocialLinkInput>,
  faq: { table: faqs, tag: TAGS.faqs, type: "faq" } as SimpleEntity<FaqInput>,
  partner: { table: partners, tag: TAGS.partners, type: "partner" } as SimpleEntity<PartnerInput>,
};

export type SimpleEntityName = keyof typeof ENTITIES;
type InputOf<K extends SimpleEntityName> = NonNullable<(typeof ENTITIES)[K]["_input"]>;

export async function saveEntity<K extends SimpleEntityName>(
  name: K,
  id: string | null,
  input: InputOf<K>,
  actor: Actor,
): Promise<string> {
  const entity = ENTITIES[name];
  const db = getDb();
  if ("slug" in input) {
    const table = entity.table as unknown as typeof services;
    const [clash] = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.slug, (input as ServiceInput).slug), id ? ne(table.id, id) : sql`true`))
      .limit(1);
    if (clash) throw new ContentError("Ce slug est déjà utilisé.", "slug");
  }

  let entityId = id;
  if (id) {
    const [before] = await db.select().from(entity.table).where(eq(entity.table.id, id)).limit(1);
    if (!before) throw new ContentError("Élément introuvable.");
    await db.update(entity.table).set(input as never).where(eq(entity.table.id, id));
    await audit(actor, `${entity.type}.update`, entity.type, id, {
      changed: changedKeys(before as Record<string, unknown>, input as Record<string, unknown>),
    });
  } else {
    const [created] = await db.insert(entity.table).values(input as never).returning({ id: entity.table.id });
    entityId = (created as { id: string }).id;
    await audit(actor, `${entity.type}.create`, entity.type, entityId);
  }
  invalidate(entity.tag);
  return entityId!;
}

export async function deleteEntity(name: SimpleEntityName, id: string, actor: Actor): Promise<void> {
  const entity = ENTITIES[name];
  const db = getDb();
  if (entity.softDelete) {
    await db
      .update(entity.table)
      .set({ deletedAt: new Date(), status: "archived" } as never)
      .where(eq(entity.table.id, id));
  } else {
    await db.delete(entity.table).where(eq(entity.table.id, id));
  }
  await audit(actor, `${entity.type}.delete`, entity.type, id);
  invalidate(entity.tag);
}

// Settings

export async function saveSetting<K extends SettingsKey>(key: K, value: SettingsValue<K>, actor: Actor): Promise<void> {
  const parsed = SETTINGS_SCHEMAS[key].parse(value);
  await getDb()
    .insert(settings)
    .values({ key, value: parsed, updatedBy: actor.id })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed, updatedBy: actor.id, updatedAt: new Date() } });
  await audit(actor, "settings.update", "settings", key);
  invalidate(TAGS.settings, TAGS.media);
}

// Media

export async function updateMedia(
  id: string,
  values: { alt: { fr: string; en: string }; needsReplacement: boolean },
  actor: Actor,
): Promise<void> {
  await getDb().update(media).set(values).where(eq(media.id, id));
  await audit(actor, "media.update", "media", id);
  invalidate(TAGS.media);
}

export async function deleteMedia(id: string, actor: Actor): Promise<void> {
  const db = getDb();
  const [usedAsCover] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.coverImageId, id), isNull(projects.deletedAt)))
    .limit(1);
  const [usedInGallery] = await db.select({ id: projectImages.id }).from(projectImages).where(eq(projectImages.mediaId, id)).limit(1);
  if (usedAsCover || usedInGallery) {
    throw new ContentError("Ce fichier est utilisé par un projet : retirez-le d'abord du projet.");
  }
  // Soft delete: the file stays on disk so a restore remains possible.
  await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, id));
  await audit(actor, "media.delete", "media", id);
  invalidate(TAGS.media);
}
