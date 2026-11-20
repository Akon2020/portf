import { createElement } from "react";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { AdminNotificationEmail, QuoteEmail } from "@/emails/templates";
import { computeTotals, formatMoney, lineTotal, parseMoney, parsePercent, type Currency } from "@/lib/money";
import { getSiteUrl } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import { z } from "@/lib/zod";
import { generateToken } from "../auth/crypto";
import { readSettingUncached } from "../content/queries";
import { getDb } from "../db";
import {
  clients,
  contacts,
  conversations,
  documentSends,
  quoteItems,
  quoteRequests,
  quotes,
  type Quote,
  type QuoteItem,
} from "../db/schema";
import { renderMail, sendMail } from "../mail/send";
import { writeAudit } from "./audit";
import { convertContactToClient, type RequestMeta } from "./inbox";
import { REQUEST_LABELS } from "./quote-requests";
import { nextDocumentNumber } from "./sequences";

export class QuoteError extends Error {}

export interface Actor extends RequestMeta {
  id: string;
}

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (date: string, days: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export function publicQuoteUrl(token: string): string {
  return new URL(`/f/${token}`, getSiteUrl()).toString();
}

// Validation of the editor form

const money = (code: string) =>
  z
    .string()
    .trim()
    .default("")
    .transform((value, context) => {
      if (value === "") return 0;
      const cents = parseMoney(value);
      if (cents === null || cents < 0) {
        context.addIssue({ code: "custom", message: code });
        return z.NEVER;
      }
      return cents;
    });

export const quoteInputSchema = z.object({
  title: z.string().trim().min(2, "Obligatoire").max(200),
  recipientName: z.string().trim().min(2, "Obligatoire").max(160),
  recipientEmail: z
    .string()
    .trim()
    .max(254)
    .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Adresse e-mail invalide")
    .transform((value) => value.toLowerCase() || null),
  recipientPhone: z.string().trim().max(30).transform((value) => value || null),
  locale: z.enum(["fr", "en"]),
  currency: z.enum(["USD", "CDF"]),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  exchangeRate: z
    .string()
    .trim()
    .default("")
    .transform((value) => value.replace(",", "."))
    .refine((value) => value === "" || (/^\d+(\.\d{1,4})?$/.test(value) && Number(value) > 0), "Taux invalide")
    .transform((value) => value || null),
  discount: money("Montant de remise invalide"),
  taxRate: z
    .string()
    .trim()
    .default("")
    .transform((value, context) => {
      const rate = parsePercent(value);
      if (rate === null) {
        context.addIssue({ code: "custom", message: "Taux de taxe invalide (0 à 100)" });
        return z.NEVER;
      }
      return rate;
    }),
  notes: z.string().trim().max(3000).transform((value) => value || null),
  terms: z.string().trim().max(5000).transform((value) => value || null),
  items: z
    .array(
      z.object({
        description: z.string().trim().max(500).default(""),
        quantity: z.string().trim().default("1"),
        unitPrice: z.string().trim().default(""),
      }),
    )
    .default([])
    .transform((rows, context) => {
      const items: { description: string; quantity: string; unitPrice: number }[] = [];
      rows.forEach((row, index) => {
        if (!row.description && !row.unitPrice) return;
        const quantity = row.quantity.replace(",", ".");
        const unitPrice = parseMoney(row.unitPrice || "0");
        if (!row.description) context.addIssue({ code: "custom", message: "Description obligatoire", path: [index, "description"] });
        if (!/^\d+(\.\d{1,3})?$/.test(quantity) || Number(quantity) <= 0) {
          context.addIssue({ code: "custom", message: "Quantité invalide", path: [index, "quantity"] });
        }
        if (unitPrice === null || unitPrice < 0) context.addIssue({ code: "custom", message: "Prix invalide", path: [index, "unitPrice"] });
        items.push({ description: row.description, quantity, unitPrice: unitPrice ?? 0 });
      });
      return items;
    }),
}).refine((value) => value.validUntil >= value.issueDate, { message: "La validité doit suivre la date d'émission", path: ["validUntil"] });

export type QuoteInput = z.infer<typeof quoteInputSchema>;

// Reading

export async function getQuote(id: string): Promise<{ quote: Quote; items: QuoteItem[] } | null> {
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), isNull(quotes.deletedAt))).limit(1);
  if (!quote) return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, id)).orderBy(asc(quoteItems.sortOrder));
  return { quote, items };
}

export async function getQuoteByToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const db = getDb();
  const [quote] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.publicToken, token), isNull(quotes.tokenRevokedAt), isNull(quotes.deletedAt)))
    .limit(1);
  if (!quote || quote.status === "draft") return null;
  const items = await db.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.sortOrder));
  return { quote, items };
}

export async function listQuotes() {
  return getDb()
    .select()
    .from(quotes)
    .where(isNull(quotes.deletedAt))
    .orderBy(desc(quotes.createdAt))
    .limit(300);
}

// Writing

/** New draft, prefilled from a quote request or a conversation when given. */
export async function createQuoteDraft(source: { requestId?: string; conversationId?: string }, actor: Actor): Promise<string> {
  const db = getDb();
  const issuer = await readSettingUncached("issuer");
  let contactId: string | null = null;
  let requestId: string | null = null;
  let title = "Proposition";
  let currency: Currency = "USD";

  if (source.requestId) {
    const [request] = await db.select().from(quoteRequests).where(eq(quoteRequests.id, source.requestId)).limit(1);
    if (request) {
      contactId = request.contactId;
      requestId = request.id;
      currency = request.currency;
      title = REQUEST_LABELS.projectType[request.projectType as keyof typeof REQUEST_LABELS.projectType] ?? title;
    }
  } else if (source.conversationId) {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, source.conversationId)).limit(1);
    if (conversation) {
      contactId = conversation.contactId;
      const [request] = await db.select().from(quoteRequests).where(eq(quoteRequests.conversationId, conversation.id)).limit(1);
      if (request) {
        requestId = request.id;
        currency = request.currency;
        title = REQUEST_LABELS.projectType[request.projectType as keyof typeof REQUEST_LABELS.projectType] ?? title;
      }
    }
  }

  const [contact] = contactId ? await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1) : [];
  const issueDate = today();
  const [created] = await db
    .insert(quotes)
    .values({
      contactId,
      clientId: contact?.clientId ?? null,
      quoteRequestId: requestId,
      recipientName: contact?.company ?? contact?.name ?? "Client",
      recipientEmail: contact?.email ?? null,
      recipientPhone: contact?.phone ?? null,
      title,
      locale: contact?.locale === "en" ? "en" : "fr",
      issueDate,
      validUntil: addDays(issueDate, issuer.quoteValidityDays),
      currency,
      exchangeRate: issuer.exchangeRate ? issuer.exchangeRate.replace(",", ".") : null,
      terms: issuer.quoteTerms || null,
      publicToken: generateToken(24),
    })
    .returning({ id: quotes.id });
  if (requestId) await db.update(quoteRequests).set({ status: "reviewing" }).where(and(eq(quoteRequests.id, requestId), eq(quoteRequests.status, "new")));
  await writeAudit({ actorId: actor.id, action: "quote.create", entityType: "quote", entityId: created.id, ip: actor.ip, userAgent: actor.userAgent });
  return created.id;
}

export async function saveQuoteDraft(id: string, input: QuoteInput, actor: Actor): Promise<void> {
  const db = getDb();
  const totals = computeTotals(input.items, input.discount, input.taxRate);
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, id)).for("update");
    if (!current) throw new QuoteError("Devis introuvable.");
    if (current.status !== "draft") throw new QuoteError("Un devis envoyé n'est plus modifiable : dupliquez-le pour le réviser.");
    const { items, discount: _discount, ...fields } = input;
    await tx.update(quotes).set({ ...fields, ...totals }).where(eq(quotes.id, id));
    await tx.delete(quoteItems).where(eq(quoteItems.quoteId, id));
    if (items.length > 0) {
      await tx.insert(quoteItems).values(
        items.map((item, index) => ({ quoteId: id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: lineTotal(item), sortOrder: index })),
      );
    }
  });
  await writeAudit({ actorId: actor.id, action: "quote.update", entityType: "quote", entityId: id, diff: { total: totals.total }, ip: actor.ip, userAgent: actor.userAgent });
}

/**
 * Locks the quote as sent: assigns its number inside the same transaction as
 * the status change, so numbers are unique and without gaps.
 */
async function lockAsSent(id: string): Promise<Quote> {
  return getDb().transaction(async (tx) => {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, id)).for("update");
    if (!quote || quote.deletedAt) throw new QuoteError("Devis introuvable.");
    if (["accepted", "declined", "expired"].includes(quote.status)) throw new QuoteError("Ce devis est clôturé.");
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(quoteItems).where(eq(quoteItems.quoteId, id));
    if (count === 0) throw new QuoteError("Ajoutez au moins une ligne avant l'envoi.");
    if (quote.number) return quote;
    const number = await nextDocumentNumber(tx, "DEV", Number(quote.issueDate.slice(0, 4)));
    const [updated] = await tx
      .update(quotes)
      .set({ number, status: "sent", sentAt: new Date() })
      .where(eq(quotes.id, id))
      .returning();
    if (updated.quoteRequestId) await tx.update(quoteRequests).set({ status: "quoted" }).where(eq(quoteRequests.id, updated.quoteRequestId));
    return updated;
  });
}

export async function sendQuoteByEmail(id: string, options: { message?: string; copyToSelf?: boolean }, actor: Actor): Promise<Quote> {
  const quote = await lockAsSent(id);
  if (!quote.recipientEmail) throw new QuoteError("Ajoutez l'e-mail du destinataire avant l'envoi.");
  const data = await getQuote(id);
  const { renderQuotePdf } = await import("@/pdf/render");
  const pdf = await renderQuotePdf(data!.quote, data!.items);
  const locale = quote.locale === "en" ? "en" : "fr";
  const dateFormat = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" });
  const issuer = await readSettingUncached("issuer");

  const sent = await sendMail({
    to: quote.recipientEmail,
    cc: options.copyToSelf && issuer.email ? issuer.email : undefined,
    replyTo: issuer.email || undefined,
    subject: locale === "fr" ? `Devis ${quote.number} : ${quote.title}` : `Quote ${quote.number}: ${quote.title}`,
    react: createElement(QuoteEmail, {
      name: quote.recipientName,
      number: quote.number!,
      total: formatMoney(quote.total, quote.currency, locale),
      validUntil: dateFormat.format(new Date(`${quote.validUntil}T12:00:00Z`)),
      url: publicQuoteUrl(quote.publicToken),
      locale,
      message: options.message?.trim() || undefined,
    }),
    attachments: [{ filename: `${quote.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  await getDb().insert(documentSends).values({
    documentType: "quote",
    documentId: id,
    channel: "email",
    recipient: quote.recipientEmail,
    sentBy: actor.id,
  });
  await writeAudit({ actorId: actor.id, action: "quote.sent_email", entityType: "quote", entityId: id, diff: { messageId: sent.messageId }, ip: actor.ip, userAgent: actor.userAgent });
  return quote;
}

/** wa.me link with the editable template. The PDF cannot be attached, the link points to /f/[token]. */
export async function prepareWhatsappSend(id: string, actor: Actor): Promise<string> {
  const quote = await lockAsSent(id);
  if (!quote.recipientPhone) throw new QuoteError("Ajoutez le numéro WhatsApp du destinataire.");
  const { whatsappQuote } = await readSettingUncached("templates");
  const locale = quote.locale === "en" ? "en" : "fr";
  const dateFormat = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" });
  const message = (whatsappQuote || "{client}, {numero} : {lien}")
    .replaceAll("{client}", quote.recipientName)
    .replaceAll("{numero}", quote.number!)
    .replaceAll("{total}", formatMoney(quote.total, quote.currency, locale))
    .replaceAll("{validite}", dateFormat.format(new Date(`${quote.validUntil}T12:00:00Z`)))
    .replaceAll("{lien}", publicQuoteUrl(quote.publicToken));
  const link = whatsappLink(quote.recipientPhone, message);
  if (!link) throw new QuoteError("Numéro WhatsApp invalide (format international attendu).");
  await getDb().insert(documentSends).values({
    documentType: "quote",
    documentId: id,
    channel: "whatsapp_link",
    recipient: quote.recipientPhone,
    sentBy: actor.id,
  });
  await writeAudit({ actorId: actor.id, action: "quote.sent_whatsapp", entityType: "quote", entityId: id, ip: actor.ip, userAgent: actor.userAgent });
  return link;
}

/** First opening of the public page by the recipient. */
export async function markQuoteViewed(quote: Quote): Promise<void> {
  if (quote.status !== "sent") return;
  const db = getDb();
  await db.update(quotes).set({ status: "viewed", viewedAt: new Date() }).where(and(eq(quotes.id, quote.id), eq(quotes.status, "sent")));
  await db
    .update(documentSends)
    .set({ openedAt: new Date() })
    .where(and(eq(documentSends.documentType, "quote"), eq(documentSends.documentId, quote.id), isNull(documentSends.openedAt)));
}

export function isExpired(quote: Pick<Quote, "validUntil">): boolean {
  return quote.validUntil < today();
}

async function notifyOwner(title: string, quote: Quote, extra: [string, string][]) {
  const issuer = await readSettingUncached("issuer");
  const to = process.env.ADMIN_EMAIL || issuer.email;
  if (!to) return;
  const mail = await renderMail(
    createElement(AdminNotificationEmail, {
      title,
      fields: [["Devis", quote.number ?? ""], ["Client", quote.recipientName], ["Montant", formatMoney(quote.total, quote.currency)], ...extra],
      url: new URL(`/admin/devis/emis/${quote.id}`, getSiteUrl()).toString(),
    }),
  );
  const { sendMailOrQueue } = await import("../mail/send");
  await sendMailOrQueue({ to, subject: `[Site] ${title} : ${quote.number}`, ...mail });
}

export type DecisionResult = { ok: true } | { ok: false; error: "invalid" | "closed" | "expired" | "name" };

/** Online acceptance: typed name, timestamp and IP are recorded. */
export async function acceptQuote(token: string, signerName: string, meta: RequestMeta): Promise<DecisionResult> {
  const name = signerName.trim().slice(0, 160);
  if (name.length < 2) return { ok: false, error: "name" };
  const found = await getQuoteByToken(token);
  if (!found) return { ok: false, error: "invalid" };
  const { quote } = found;
  if (!["sent", "viewed"].includes(quote.status)) return { ok: false, error: "closed" };
  if (isExpired(quote)) return { ok: false, error: "expired" };
  const [updated] = await getDb()
    .update(quotes)
    .set({ status: "accepted", acceptedAt: new Date(), acceptedBy: name, acceptedIp: meta.ip })
    .where(and(eq(quotes.id, quote.id), inArray(quotes.status, ["sent", "viewed"])))
    .returning();
  if (!updated) return { ok: false, error: "closed" };
  if (updated.quoteRequestId) await getDb().update(quoteRequests).set({ status: "won" }).where(eq(quoteRequests.id, updated.quoteRequestId));
  await writeAudit({ actorId: null, action: "quote.accepted", entityType: "quote", entityId: quote.id, diff: { name }, ...meta });
  await notifyOwner("Devis accepté en ligne", updated, [["Signataire", name], ["Adresse IP", meta.ip]]);
  return { ok: true };
}

export async function declineQuote(token: string, meta: RequestMeta): Promise<DecisionResult> {
  const found = await getQuoteByToken(token);
  if (!found) return { ok: false, error: "invalid" };
  const [updated] = await getDb()
    .update(quotes)
    .set({ status: "declined", declinedAt: new Date() })
    .where(and(eq(quotes.id, found.quote.id), inArray(quotes.status, ["sent", "viewed"])))
    .returning();
  if (!updated) return { ok: false, error: "closed" };
  if (updated.quoteRequestId) await getDb().update(quoteRequests).set({ status: "lost" }).where(eq(quoteRequests.id, updated.quoteRequestId));
  await writeAudit({ actorId: null, action: "quote.declined", entityType: "quote", entityId: updated.id, ...meta });
  await notifyOwner("Devis refusé en ligne", updated, []);
  return { ok: true };
}

/** Nightly: sent or viewed quotes past their validity become expired. */
export async function expireQuotes(): Promise<number> {
  const rows = await getDb()
    .update(quotes)
    .set({ status: "expired" })
    .where(and(inArray(quotes.status, ["sent", "viewed"]), lt(quotes.validUntil, today())))
    .returning({ id: quotes.id });
  return rows.length;
}

/**
 * Accepted quote: creates or links the client. Client project, milestones and
 * deposit invoice are added by the CRM and invoicing module.
 */
export async function convertQuote(id: string, actor: Actor): Promise<string> {
  const db = getDb();
  const data = await getQuote(id);
  if (!data) throw new QuoteError("Devis introuvable.");
  const { quote } = data;
  if (quote.status !== "accepted") throw new QuoteError("Seul un devis accepté peut être converti.");
  let clientId = quote.clientId;
  if (!clientId && quote.contactId) clientId = await convertContactToClient(quote.contactId, actor.id, actor);
  if (!clientId) {
    const [client] = await db
      .insert(clients)
      .values({ name: quote.recipientName, email: quote.recipientEmail, phone: quote.recipientPhone, whatsapp: quote.recipientPhone })
      .returning({ id: clients.id });
    clientId = client.id;
  }
  await db.update(quotes).set({ clientId, convertedAt: new Date() }).where(eq(quotes.id, id));
  await writeAudit({ actorId: actor.id, action: "quote.converted", entityType: "quote", entityId: id, diff: { clientId }, ip: actor.ip, userAgent: actor.userAgent });
  return clientId;
}

/** Revision of a sent quote: a new draft with the same content. */
export async function duplicateQuote(id: string, actor: Actor): Promise<string> {
  const data = await getQuote(id);
  if (!data) throw new QuoteError("Devis introuvable.");
  const { quote, items } = data;
  const db = getDb();
  const issueDate = today();
  const issuer = await readSettingUncached("issuer");
  const [copy] = await db
    .insert(quotes)
    .values({
      contactId: quote.contactId,
      clientId: quote.clientId,
      quoteRequestId: quote.quoteRequestId,
      recipientName: quote.recipientName,
      recipientEmail: quote.recipientEmail,
      recipientPhone: quote.recipientPhone,
      title: quote.title,
      locale: quote.locale,
      issueDate,
      validUntil: addDays(issueDate, issuer.quoteValidityDays),
      currency: quote.currency,
      exchangeRate: quote.exchangeRate,
      subtotal: quote.subtotal,
      discount: quote.discount,
      taxRate: quote.taxRate,
      taxAmount: quote.taxAmount,
      total: quote.total,
      notes: quote.notes,
      terms: quote.terms,
      publicToken: generateToken(24),
    })
    .returning({ id: quotes.id });
  if (items.length > 0) {
    await db.insert(quoteItems).values(items.map(({ id: _id, quoteId: _quote, ...item }) => ({ ...item, quoteId: copy.id })));
  }
  await writeAudit({ actorId: actor.id, action: "quote.duplicate", entityType: "quote", entityId: copy.id, diff: { from: id }, ip: actor.ip, userAgent: actor.userAgent });
  return copy.id;
}

export async function deleteQuoteDraft(id: string, actor: Actor): Promise<void> {
  const [quote] = await getDb().select({ status: quotes.status }).from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!quote) return;
  if (quote.status !== "draft") throw new QuoteError("Seul un brouillon peut être supprimé.");
  await getDb().update(quotes).set({ deletedAt: new Date() }).where(eq(quotes.id, id));
  await writeAudit({ actorId: actor.id, action: "quote.delete", entityType: "quote", entityId: id, ip: actor.ip, userAgent: actor.userAgent });
}
