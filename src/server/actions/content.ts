"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { issuesToErrors, parseFormData } from "@/lib/form-data";
import { cleanLocalizedText } from "@/lib/typography";
import { requireAdmin } from "../auth/guards";
import { getDb } from "../db";
import { journeyItems, projects, testimonials } from "../db/schema";
import {
  ContentError,
  deleteEntity,
  deleteMedia,
  deleteProject,
  duplicateProject,
  invalidate,
  saveEntity,
  saveProject,
  saveSetting,
  updateMedia,
  type Actor,
  type SimpleEntityName,
} from "../content/mutations";
import { TAGS } from "../content/queries";
import {
  journeySchema,
  mediaUpdateSchema,
  projectSchema,
  serviceSchema,
  skillSchema,
  socialLinkSchema, faqSchema, partnerSchema,
  statSchema,
  testimonialSchema,
} from "../content/schemas";
import { SETTINGS_SCHEMAS, type SettingsKey } from "../content/settings-schema";
import { getRequestContext } from "../request-context";
import { writeAudit } from "../services/audit";

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

async function currentActor(): Promise<Actor> {
  const { user } = await requireAdmin({ roles: ["super_admin", "editor"] });
  const context = await getRequestContext();
  return { id: user.id, ip: context.ip, userAgent: context.userAgent };
}

function failure(error: unknown): FormState {
  if (error instanceof ContentError) {
    return { ok: false, message: error.message, errors: error.field ? { [error.field]: error.message } : undefined };
  }
  throw error;
}

const INVALID = "Le formulaire contient des erreurs.";

/** Entity names as they appear in admin URLs. */
export type EntityRoute = "parcours" | "competences" | "services" | "temoignages" | "chiffres" | "reseaux" | "faq" | "partenaires";

const ENTITY_CONFIG = {
  parcours: { entity: "journey", schema: journeySchema, booleans: ["needsReview"] },
  competences: { entity: "skill", schema: skillSchema, booleans: ["isVisible"] },
  services: { entity: "service", schema: serviceSchema, booleans: ["isVisible"] },
  temoignages: { entity: "testimonial", schema: testimonialSchema, booleans: ["needsReview"] },
  chiffres: { entity: "stat", schema: statSchema, booleans: ["isVisible"] },
  reseaux: { entity: "social", schema: socialLinkSchema, booleans: ["isVisible"] },
  faq: { entity: "faq", schema: faqSchema, booleans: ["isVisible", "showOnHome"] },
  partenaires: { entity: "partner", schema: partnerSchema, booleans: ["isVisible"] },
} as const satisfies Record<EntityRoute, { entity: SimpleEntityName; schema: unknown; booleans: string[] }>;

// Projects

export async function saveProjectAction(id: string | null, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await currentActor();
  const parsed = projectSchema.safeParse(
    parseFormData(formData, { booleans: ["confidential", "isFeatured", "needsReview"] }),
  );
  if (!parsed.success) return { ok: false, message: INVALID, errors: issuesToErrors(parsed.error.issues) };
  let projectId: string;
  try {
    projectId = await saveProject(id, parsed.data, actor);
  } catch (error) {
    return failure(error);
  }
  if (!id) redirect(`/admin/contenu/projets/${projectId}?enregistre=1`);
  return { ok: true, message: "Projet enregistré." };
}

export async function deleteProjectAction(id: string): Promise<void> {
  await deleteProject(id, await currentActor());
  redirect("/admin/contenu/projets");
}

export async function duplicateProjectAction(id: string): Promise<void> {
  const copy = await duplicateProject(id, await currentActor());
  redirect(`/admin/contenu/projets/${copy}`);
}

// Simple entities

export async function saveEntityAction(
  route: EntityRoute,
  id: string | null,
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await currentActor();
  const config = ENTITY_CONFIG[route];
  const parsed = config.schema.safeParse(parseFormData(formData, { booleans: [...config.booleans] }));
  if (!parsed.success) return { ok: false, message: INVALID, errors: issuesToErrors(parsed.error.issues) };
  let entityId: string;
  try {
    entityId = await saveEntity(config.entity, id, parsed.data as never, actor);
  } catch (error) {
    return failure(error);
  }
  if (!id) redirect(`/admin/contenu/${route}/${entityId}?enregistre=1`);
  return { ok: true, message: "Modifications enregistrées." };
}

export async function deleteEntityAction(route: EntityRoute, id: string): Promise<void> {
  await deleteEntity(ENTITY_CONFIG[route].entity, id, await currentActor());
  redirect(`/admin/contenu/${route}`);
}

// Review queue

export async function markReviewedAction(type: "project" | "journey" | "testimonial", id: string): Promise<void> {
  const actor = await currentActor();
  const db = getDb();
  const values = { needsReview: false, reviewNote: null };
  if (type === "project") await db.update(projects).set(values).where(eq(projects.id, id));
  if (type === "journey") await db.update(journeyItems).set(values).where(eq(journeyItems.id, id));
  if (type === "testimonial") await db.update(testimonials).set(values).where(eq(testimonials.id, id));
  await writeAudit({ actorId: actor.id, action: `${type}.reviewed`, entityType: type, entityId: id, ip: actor.ip });
  invalidate(TAGS.projects, TAGS.journey, TAGS.testimonials);
}

// Settings

/** Applies the typographic clean-up to every localized value of a settings object. */
function cleanDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cleanDeep);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length > 0 && keys.every((key) => key === "fr" || key === "en")) {
      return cleanLocalizedText(record as { fr?: string; en?: string });
    }
    return Object.fromEntries(keys.map((key) => [key, cleanDeep(record[key])]));
  }
  return value;
}

const SETTINGS_BOOLEANS: Record<SettingsKey, string[]> = {
  profile: ["available"],
  contact: [],
  legal: [],
  cv: [],
  templates: [],
  issuer: [],
  security: ["alertOnCritical", "alertOnAutoBan", "trackAudience"],
};

export async function saveSettingsAction(key: SettingsKey, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await currentActor();
  const raw = parseFormData(formData, { booleans: SETTINGS_BOOLEANS[key] });
  if (key === "templates" && Array.isArray(raw.replies)) {
    raw.replies = (raw.replies as { title?: string; body?: string }[]).filter((item) => item?.title?.trim() && item?.body?.trim());
  }
  if (key === "profile" && Array.isArray(raw.values)) {
    raw.values = (raw.values as { title?: { fr?: string } }[]).filter((value) => value?.title?.fr?.trim());
  }
  for (const field of ["portraitMediaId", "frMediaId", "enMediaId", "logoMediaId"]) {
    if (raw[field] === "") raw[field] = null;
  }
  const parsed = SETTINGS_SCHEMAS[key].safeParse(cleanDeep(raw));
  if (!parsed.success) return { ok: false, message: INVALID, errors: issuesToErrors(parsed.error.issues) };
  await saveSetting(key, parsed.data as never, actor);
  return { ok: true, message: "Paramètres enregistrés." };
}

// Media

export async function updateMediaAction(id: string, _state: FormState, formData: FormData): Promise<FormState> {
  const actor = await currentActor();
  const parsed = mediaUpdateSchema.safeParse(parseFormData(formData, { booleans: ["needsReplacement"] }));
  if (!parsed.success) return { ok: false, message: INVALID, errors: issuesToErrors(parsed.error.issues) };
  await updateMedia(id, parsed.data, actor);
  return { ok: true, message: "Média mis à jour." };
}

export async function deleteMediaAction(id: string, _state: FormState): Promise<FormState> {
  try {
    await deleteMedia(id, await currentActor());
  } catch (error) {
    return failure(error);
  }
  redirect("/admin/contenu/medias");
}
