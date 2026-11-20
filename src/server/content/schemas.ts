import { z } from "zod";
import { cleanTypography } from "@/lib/typography";
import { PROJECT_CATEGORIES } from "../db/schema/content";

/** Localized text with typographic clean-up applied on both languages. */
export const localized = (options: { required?: boolean; max?: number } = {}) =>
  z
    .object({
      fr: z.string().trim().max(options.max ?? 20_000).default(""),
      en: z.string().trim().max(options.max ?? 20_000).optional().default(""),
    })
    .optional()
    .transform((value) => ({
      fr: cleanTypography(value?.fr ?? "", "fr"),
      en: cleanTypography(value?.en ?? "", "en"),
    }))
    .refine((value) => !options.required || value.fr.length > 0, {
      message: "Le texte français est obligatoire",
      path: ["fr"],
    });

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug trop court")
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lettres minuscules, chiffres et tirets simples uniquement");

const url = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\/[^\s]+$/.test(value), "Adresse web invalide")
  .transform((value) => value || null);

const isoDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Date au format AAAA-MM-JJ")
  .transform((value) => value || null);

const uuidOrNull = z
  .string()
  .trim()
  .transform((value) => value || null)
  .pipe(z.uuid().nullable());

const order = z.coerce.number().int().min(-10_000).max(10_000).default(0);
const status = z.enum(["draft", "published", "archived"]);

/** Comma or newline separated list. */
export const stringList = z
  .string()
  .default("")
  .transform((value) =>
    value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );

export const projectSchema = z.object({
  slug,
  title: localized({ required: true, max: 200 }),
  summary: localized({ max: 600 }),
  problem: localized(),
  objective: localized(),
  role: localized(),
  body: localized(),
  results: z
    .array(z.object({ label: localized({ max: 200 }), value: z.string().trim().max(80) }))
    .default([])
    .transform((rows) => rows.filter((row) => row.value && row.label.fr)),
  categories: z.array(z.enum(PROJECT_CATEGORIES)).default([]),
  techStack: stringList,
  stage: z.enum(["concept", "in_progress", "completed", "maintained"]),
  projectType: z.enum(["personal", "client", "team", "academic"]),
  confidential: z.boolean().default(false),
  coverImageId: uuidOrNull,
  galleryIds: z.array(z.uuid()).default([]),
  demoUrl: url,
  repoUrl: url,
  startedAt: isoDate,
  endedAt: isoDate,
  clientName: z.string().trim().max(200).transform((value) => value || null),
  isFeatured: z.boolean().default(false),
  sortOrder: order,
  status,
  needsReview: z.boolean().default(false),
  reviewNote: z.string().trim().max(2000).transform((value) => value || null),
  seoTitle: localized({ max: 120 }),
  seoDescription: localized({ max: 300 }),
});

export const journeySchema = z.object({
  type: z.enum(["experience", "education", "community", "speaking", "award"]),
  organization: z.string().trim().min(1).max(200),
  title: localized({ required: true, max: 200 }),
  description: localized({ max: 4000 }),
  location: z.string().trim().max(120).transform((value) => value || null),
  startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ"),
  endDate: isoDate,
  url,
  highlights: z.array(localized({ max: 400 })).default([]).transform((rows) => rows.filter((row) => row.fr)),
  sortOrder: order,
  status,
  needsReview: z.boolean().default(false),
  reviewNote: z.string().trim().max(2000).transform((value) => value || null),
});

export const skillSchema = z.object({
  name: z.string().trim().min(1).max(80),
  group: z.enum(["frontend", "backend", "mobile", "database", "cloud", "ai", "security", "tools"]),
  level: z.enum(["advanced", "confirmed", "intermediate"]),
  iconSlug: z.string().trim().max(60).transform((value) => value || null),
  sortOrder: order,
  isVisible: z.boolean().default(true),
});

export const serviceSchema = z.object({
  slug,
  title: localized({ required: true, max: 160 }),
  description: localized({ max: 2000 }),
  deliverables: z.array(localized({ max: 300 })).default([]).transform((rows) => rows.filter((row) => row.fr)),
  startingPrice: z
    .string()
    .trim()
    .default("")
    .transform((value) => (value === "" ? null : Math.round(Number(value.replace(",", ".")) * 100)))
    .refine((value) => value === null || (Number.isFinite(value) && value >= 0), "Montant invalide"),
  currency: z.enum(["USD", "CDF"]),
  icon: z.string().trim().max(60).transform((value) => value || null),
  sortOrder: order,
  isVisible: z.boolean().default(true),
});

export const testimonialSchema = z.object({
  authorName: z.string().trim().min(1).max(160),
  authorRole: localized({ max: 160 }),
  authorCompany: z.string().trim().max(160).transform((value) => value || null),
  authorPhotoId: uuidOrNull,
  authorUrl: url,
  quote: localized({ required: true, max: 1500 }),
  projectId: uuidOrNull,
  status: z.enum(["pending", "approved", "hidden"]),
  needsReview: z.boolean().default(false),
  reviewNote: z.string().trim().max(2000).transform((value) => value || null),
  sortOrder: order,
});

export const statSchema = z.object({
  label: localized({ required: true, max: 120 }),
  value: z.string().trim().min(1).max(20),
  suffix: z.string().trim().max(10).transform((value) => value || null),
  sortOrder: order,
  isVisible: z.boolean().default(true),
});

export const socialLinkSchema = z.object({
  platform: z.enum([
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
  ]),
  label: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((value) => /^(https?:\/\/|mailto:)/.test(value), "Adresse web ou mailto: attendue"),
  handle: z.string().trim().max(80).transform((value) => value || null),
  isVisible: z.boolean().default(true),
  sortOrder: order,
});

export const mediaUpdateSchema = z.object({
  alt: localized({ max: 300 }),
  needsReplacement: z.boolean().default(false),
});

export type ProjectInput = z.infer<typeof projectSchema>;
export type JourneyInput = z.infer<typeof journeySchema>;
export type SkillInput = z.infer<typeof skillSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type TestimonialInput = z.infer<typeof testimonialSchema>;
export type StatInput = z.infer<typeof statSchema>;
export type SocialLinkInput = z.infer<typeof socialLinkSchema>;
