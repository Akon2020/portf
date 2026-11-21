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

/** Issuer printed on quotes, invoices and receipts. */
export const issuerSettingsSchema = z.object({
  name: z.string().trim().min(1, "Obligatoire").max(120),
  businessName: z.string().trim().max(120).default(""),
  address: z.string().trim().max(400).default(""),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(254).default(""),
  website: z.string().trim().max(200).default(""),
  legalIds: z.string().trim().max(400).default(""),
  paymentDetails: z.string().trim().max(1500).default(""),
  footer: z.string().trim().max(600).default(""),
  quoteValidityDays: z.coerce.number().int().min(1).max(365).default(30),
  quoteTerms: z.string().trim().max(3000).default(""),
  invoiceTerms: z.string().trim().max(3000).default(""),
  exchangeRate: z.string().trim().max(20).default(""),
});

export const templatesSettingsSchema = z.object({
  replies: z
    .array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(5000) }))
    .max(30)
    .default([]),
  whatsappQuote: z.string().trim().max(1000).default(""),
  whatsappInvoice: z.string().trim().max(1000).default(""),
  whatsappReminder: z.string().trim().max(1000).default(""),
  whatsappReceipt: z.string().trim().max(1000).default(""),
});

export type ProfileSettings = z.infer<typeof profileSettingsSchema>;
export type ContactSettings = z.infer<typeof contactSettingsSchema>;
export type LegalSettings = z.infer<typeof legalSettingsSchema>;
export type CvSettings = z.infer<typeof cvSettingsSchema>;
export type TemplatesSettings = z.infer<typeof templatesSettingsSchema>;
export type IssuerSettings = z.infer<typeof issuerSettingsSchema>;

/** Thresholds of the security module. */
export const securitySettingsSchema = z.object({
  autoBanThreshold: z.coerce.number().int().min(20).max(1000).default(60),
  alertOnCritical: z.boolean().default(true),
  alertOnAutoBan: z.boolean().default(true),
  trackAudience: z.boolean().default(true),
});

export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const SETTINGS_SCHEMAS = {
  profile: profileSettingsSchema,
  contact: contactSettingsSchema,
  legal: legalSettingsSchema,
  cv: cvSettingsSchema,
  templates: templatesSettingsSchema,
  issuer: issuerSettingsSchema,
  security: securitySettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;

const PARAGRAPH = String.fromCharCode(10, 10);

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
  issuer: {
    name: "Isaac Akonkwa",
    businessName: "Akon Tech",
    address: "Bukavu, Sud-Kivu, République démocratique du Congo",
    phone: "",
    email: "akonkwaushindi@gmail.com",
    website: "",
    legalIds: "",
    paymentDetails: "",
    footer: "",
    quoteValidityDays: 30,
    quoteTerms: "",
    invoiceTerms: "",
    exchangeRate: "",
  },
  templates: {
    replies: [
      {
        title: "Premier échange",
        body: [
          "Bonjour,",
          "Merci pour votre message et pour l'intérêt porté à mon travail. Pour bien comprendre votre besoin, pourriez-vous préciser vos objectifs, vos délais et votre budget indicatif ?",
          "Je vous propose aussi un court appel pour en discuter.",
        ].join(PARAGRAPH),
      },
      {
        title: "First contact (EN)",
        body: [
          "Hello,",
          "Thank you for your message. To understand your needs, could you share your goals, timeline and indicative budget?",
          "I would also be happy to schedule a short call.",
        ].join(PARAGRAPH),
      },
    ],
    whatsappQuote:
      "Bonjour {client}, voici votre devis {numero} d'un montant de {total}, valable jusqu'au {validite}. Vous pouvez le consulter et l'accepter ici : {lien}. Merci, Isaac Akonkwa.",
    whatsappInvoice:
      "Bonjour {client}, voici votre facture {numero} d'un montant de {total}, à régler avant le {echeance}. Vous pouvez la consulter et la télécharger ici : {lien}. Merci, Isaac Akonkwa.",
    whatsappReminder:
      "Bonjour {client}, petit rappel concernant la facture {numero} : il reste {solde} à régler (échéance le {echeance}). Vous pouvez la consulter ici : {lien}. Merci, Isaac Akonkwa.",
    whatsappReceipt: "Bonjour {client}, merci pour votre paiement de {montant} (facture {facture}). Voici votre reçu {numero} : {lien}. Isaac Akonkwa.",
  },
  security: { autoBanThreshold: 60, alertOnCritical: true, alertOnAutoBan: true, trackAudience: true },
};
