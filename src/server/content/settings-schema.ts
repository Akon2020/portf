import { z } from "@/lib/zod";

export const localizedSchema = z.object({
  fr: z.string().trim().max(20_000),
  en: z.string().trim().max(20_000).optional().default(""),
});

const requiredLocalized = localizedSchema.refine((value) => value.fr.length > 0, {
  message: "Le texte français est obligatoire",
  path: ["fr"],
});

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || /^https?:\/\//.test(value), "Adresse web invalide (http ou https)")
  .default("");

export const profileSettingsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: requiredLocalized,
  tagline: requiredLocalized,
  heroHeading: requiredLocalized,
  heroIntro: requiredLocalized,
  profileHeading: requiredLocalized,
  profileText: requiredLocalized,
  bioLong: localizedSchema,
  location: localizedSchema,
  foundedYear: z.coerce.number().int().min(1990).max(2100),
  available: z.boolean(),
  availabilityLabel: requiredLocalized,
  slogan: z.enum(["Made with intention.", "Building code that builds change."]),
  portraitMediaId: z.string().uuid().nullable().default(null),
  values: z.array(z.object({ title: localizedSchema, text: localizedSchema })).max(8).default([]),
});

export const contactSettingsSchema = z.object({
  email: z.email(),
  whatsapp: z
    .string()
    .trim()
    .max(20)
    .refine((value) => value === "" || /^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s.()-]/g, "")), "Numéro au format international, par exemple +243 970 000 000")
    .default(""),
  calendlyUrl: optionalUrl,
  responseTime: requiredLocalized,
  openTo: requiredLocalized,
  contactHeading: requiredLocalized,
  contactText: requiredLocalized,
});

export const legalSettingsSchema = z.object({
  legalNotice: localizedSchema,
  privacyPolicy: localizedSchema,
});

export const cvSettingsSchema = z.object({
  frMediaId: z.string().uuid().nullable().default(null),
  enMediaId: z.string().uuid().nullable().default(null),
});

export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type ContactSettings = z.infer<typeof contactSettingsSchema>;
export type LegalSettings = z.infer<typeof legalSettingsSchema>;
export type CvSettings = z.infer<typeof cvSettingsSchema>;

export const SETTINGS_SCHEMAS = {
  profile: profileSettingsSchema,
  contact: contactSettingsSchema,
  legal: legalSettingsSchema,
  cv: cvSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

export const DEFAULT_SETTINGS: { [K in SettingsKey]: SettingsValue<K> } = {
  profile: {
    name: "Isaac Akonkwa",
    title: { fr: "Ingénieur logiciel", en: "Software Engineer" },
    tagline: {
      fr: "Full-stack engineer, builder et mentor. Je transforme des problèmes complexes en expériences web, mobiles et IA simples à utiliser.",
      en: "Full-stack engineer, builder and mentor. I turn complex problems into simple web, mobile and AI experiences.",
    },
    heroHeading: {
      fr: "Je conçois des produits numériques qui créent un impact réel.",
      en: "I build digital products that create meaningful impact.",
    },
    heroIntro: {
      fr: "Full-stack engineer, builder et mentor. Je transforme des problèmes complexes en expériences web, mobiles et IA simples à utiliser.",
      en: "Full-stack engineer, builder and mentor. I turn complex problems into simple web, mobile and AI experiences.",
    },
    profileHeading: { fr: "La technique au service des personnes.", en: "Technology in service of people." },
    profileText: {
      fr: "Depuis Bukavu, je développe des solutions accessibles et robustes à la croisée du produit, de la donnée et de l’intelligence artificielle. Mon approche mêle exigence technique, curiosité et transmission.",
      en: "From Bukavu, I build accessible and resilient solutions at the intersection of product, data and artificial intelligence. My approach combines technical rigor, curiosity and mentorship.",
    },
    bioLong: { fr: "", en: "" },
    location: { fr: "Bukavu, RDC", en: "Bukavu, DRC" },
    foundedYear: 2020,
    available: true,
    availabilityLabel: {
      fr: "Disponible pour de nouvelles collaborations",
      en: "Available for new collaborations",
    },
    slogan: "Made with intention.",
    portraitMediaId: null,
    values: [],
  },
  contact: {
    email: "akonkwaushindi@gmail.com",
    whatsapp: "",
    calendlyUrl: "https://calendly.com/akon1703",
    responseTime: { fr: "Réponse sous 24 à 48 h", en: "Reply within 24 to 48 hours" },
    openTo: {
      fr: "Ouvert aux missions freelance, aux collaborations et aux postes à temps plein.",
      en: "Open to freelance work, collaborations and full time roles.",
    },
    contactHeading: { fr: "Une idée à faire grandir ?", en: "An idea worth growing?" },
    contactText: {
      fr: "Échangeons sur votre produit, votre équipe ou votre prochaine étape.",
      en: "Let’s talk about your product, team or next chapter.",
    },
  },
  legal: { legalNotice: { fr: "", en: "" }, privacyPolicy: { fr: "", en: "" } },
  cv: { frMediaId: null, enMediaId: null },
};
