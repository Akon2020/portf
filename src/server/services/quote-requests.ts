import { desc, eq, sql } from "drizzle-orm";
import { z } from "@/lib/zod";
import { getDb } from "../db";
import { quoteRequests, type Attachment, type QuoteRequest } from "../db/schema";
import { receiveInbound, type Locale, type RequestMeta } from "./inbox";

export const PROJECT_TYPES = [
  "showcase_site",
  "web_app",
  "mobile_app",
  "ecommerce",
  "ai_integration",
  "security_audit",
  "training",
  "other",
] as const;
export const FEATURES = ["accounts", "payments", "admin", "multilingual", "offline", "notifications", "analytics", "api"] as const;
export const BUDGETS = ["lt500", "500_1500", "1500_5000", "5000_15000", "gt15000", "unknown"] as const;
export const DEADLINES = ["asap", "1_month", "3_months", "6_months", "flexible"] as const;
export const CONTACT_CHANNELS = ["email", "whatsapp", "call"] as const;

/** French labels used in the admin and in the stored summary message. */
export const REQUEST_LABELS = {
  projectType: {
    showcase_site: "Site vitrine",
    web_app: "Application web",
    mobile_app: "Application mobile",
    ecommerce: "E-commerce",
    ai_integration: "Intégration IA",
    security_audit: "Audit de sécurité",
    training: "Formation ou mentorat",
    other: "Autre",
  },
  features: {
    accounts: "Comptes utilisateurs",
    payments: "Paiements (Mobile Money, carte)",
    admin: "Back-office",
    multilingual: "Plusieurs langues",
    offline: "Fonctionnement hors ligne",
    notifications: "Notifications",
    analytics: "Statistiques",
    api: "API ou intégrations",
  },
  budget: {
    lt500: "Moins de 500 USD",
    "500_1500": "500 à 1 500 USD",
    "1500_5000": "1 500 à 5 000 USD",
    "5000_15000": "5 000 à 15 000 USD",
    gt15000: "Plus de 15 000 USD",
    unknown: "À définir",
  },
  deadline: { asap: "Dès que possible", "1_month": "Sous 1 mois", "3_months": "Sous 3 mois", "6_months": "Sous 6 mois", flexible: "Flexible" },
  channel: { email: "E-mail", whatsapp: "WhatsApp", call: "Appel" },
  status: { new: "Nouvelle", reviewing: "En analyse", quoted: "Devis envoyé", won: "Gagnée", lost: "Perdue" },
} as const;

const links = z
  .string()
  .max(2000, "tooLong")
  .default("")
  .transform((value) =>
    value
      .split(/[\n\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .refine((items) => items.length <= 10 && items.every((item) => /^https?:\/\/\S+$/.test(item)), "url");

export const quoteRequestSchema = z.object({
  projectType: z.enum(PROJECT_TYPES, "required"),
  services: z.array(z.string().max(80)).max(10).default([]),
  description: z.string().trim().min(30, "min30").max(5000, "tooLong"),
  features: z.array(z.enum(FEATURES)).max(FEATURES.length).default([]),
  featuresOther: z.string().trim().max(500, "tooLong").default(""),
  hasDesign: z.enum(["yes", "no"], "required"),
  referenceLinks: links,
  budgetRange: z.enum(BUDGETS, "required"),
  currency: z.enum(["USD", "CDF"]).default("USD"),
  deadline: z.enum(DEADLINES, "required"),
  name: z.string().trim().min(2, "required").max(120, "tooLong"),
  email: z.string().trim().max(254).pipe(z.email("email")),
  phone: z
    .string()
    .trim()
    .max(30, "tooLong")
    .refine((value) => value === "" || /^[+\d][\d\s().-]{6,}$/.test(value), "phone")
    .transform((value) => value || null),
  company: z.string().trim().max(160, "tooLong").transform((value) => value || null),
  preferredContact: z.enum(CONTACT_CHANNELS, "required"),
  consent: z.literal("1", "consent"),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

/** Readable summary stored as the first message of the conversation. */
export function summarizeRequest(input: QuoteRequestInput): string {
  const L = REQUEST_LABELS;
  const lines = [
    `Type de projet : ${L.projectType[input.projectType]}`,
    input.services.length ? `Services : ${input.services.join(", ")}` : null,
    `Budget : ${L.budget[input.budgetRange]} (paiement en ${input.currency})`,
    `Délai : ${L.deadline[input.deadline]}`,
    `Maquettes existantes : ${input.hasDesign === "yes" ? "oui" : "non"}`,
    input.features.length ? `Fonctionnalités : ${input.features.map((feature) => L.features[feature]).join(", ")}` : null,
    input.featuresOther ? `Autres fonctionnalités : ${input.featuresOther}` : null,
    input.referenceLinks.length ? `Références : ${input.referenceLinks.join(" ")}` : null,
    input.company ? `Organisation : ${input.company}` : null,
    `Contact préféré : ${L.channel[input.preferredContact]}`,
    "",
    input.description,
  ];
  return lines.filter((line) => line !== null).join("\n");
}

export async function submitQuoteRequest(
  input: QuoteRequestInput,
  attachments: Attachment[],
  locale: Locale,
  meta: RequestMeta,
): Promise<QuoteRequest> {
  const { conversation } = await receiveInbound(
    {
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      topic: "project",
      message: summarizeRequest(input),
      locale,
      source: "quote_form",
      attachments,
      subject: `Devis : ${REQUEST_LABELS.projectType[input.projectType]} : ${input.name}`,
    },
    meta,
  );
  const [request] = await getDb()
    .insert(quoteRequests)
    .values({
      contactId: conversation.contactId,
      conversationId: conversation.id,
      projectType: input.projectType,
      services: input.services,
      description: input.description,
      features: [...input.features, ...(input.featuresOther ? [input.featuresOther] : [])],
      budgetRange: input.budgetRange,
      currency: input.currency,
      deadline: input.deadline,
      hasDesign: input.hasDesign === "yes",
      referenceLinks: input.referenceLinks,
      attachments,
      preferredContact: input.preferredContact,
      locale,
    })
    .returning();
  return request;
}

export async function newQuoteRequestCount(): Promise<number> {
  const [row] = await getDb()
    .select({ total: sql<number>`count(*)::int` })
    .from(quoteRequests)
    .where(eq(quoteRequests.status, "new"));
  return row?.total ?? 0;
}

export async function listQuoteRequests() {
  return getDb().select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt)).limit(300);
}
