import { createElement } from "react";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { DocumentEmail } from "@/emails/templates";
import { computeTotals, formatMoney, lineTotal, parseMoney, type Currency } from "@/lib/money";
import { getSiteUrl } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import { z } from "@/lib/zod";
import { generateToken } from "../auth/crypto";
import { readSettingUncached } from "../content/settings-store";
import { getDb } from "../db";
import {
  clientProjects,
  clients,
  documentSends,
  invoiceItems,
  invoices,
  milestones,
  payments,
  quoteItems,
  quotes,
  receipts,
  type Invoice,
  type InvoiceItem,
  type Payment,
  type PaymentMethod,
  type Receipt,
} from "../db/schema";
import { sendMail } from "../mail/send";
import { writeAudit } from "./audit";
import type { RequestMeta } from "./inbox";
import { addDays, documentBaseSchema, today } from "./quotes";
import { nextDocumentNumber } from "./sequences";

export class InvoiceError extends Error {}

const NBSP = String.fromCharCode(0xa0);

export interface Actor extends RequestMeta {
  id: string;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { fr: string; en: string }> = {
  cash: { fr: "Espèces", en: "Cash" },
  mpesa: { fr: "M-Pesa", en: "M-Pesa" },
  airtel_money: { fr: "Airtel Money", en: "Airtel Money" },
  orange_money: { fr: "Orange Money", en: "Orange Money" },
  bank_transfer: { fr: "Virement bancaire", en: "Bank transfer" },
  card: { fr: "Carte bancaire", en: "Card" },
  other: { fr: "Autre", en: "Other" },
};

export const INVOICE_STATUS_LABELS: Record<Invoice["status"], string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  viewed: "Consultée",
  partially_paid: "Partiellement payée",
  paid: "Payée",
  overdue: "En retard",
  cancelled: "Annulée",
};

/** Statuses where money is still expected. */
export const OPEN_STATUSES: Invoice["status"][] = ["sent", "viewed", "partially_paid", "overdue"];

export function publicDocumentUrl(token: string): string {
  return new URL(`/f/${token}`, getSiteUrl()).toString();
}

const dateFormat = (locale: "fr" | "en") => new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" });
export const formatDocDate = (value: string, locale: "fr" | "en") => dateFormat(locale).format(new Date(`${value}T12:00:00Z`));

// Validation

export const invoiceInputSchema = documentBaseSchema
  .extend({
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
    recipientAddress: z.string().trim().max(400).default("").transform((value) => value || null),
  })
  .refine((value) => value.dueDate >= value.issueDate, { message: "L'échéance doit suivre la date d'émission", path: ["dueDate"] });

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export const paymentInputSchema = z.object({
  amount: z
    .string()
    .trim()
    .transform((value, context) => {
      const cents = parseMoney(value);
      if (cents === null || cents <= 0) {
        context.addIssue({ code: "custom", message: "Montant invalide" });
        return z.NEVER;
      }
      return cents;
    }),
  method: z.enum(["cash", "mpesa", "airtel_money", "orange_money", "bank_transfer", "card", "other"]),
  reference: z.string().trim().max(120).default("").transform((value) => value || null),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide")
    .refine((value) => value <= today(), "La date ne peut pas être dans le futur"),
  note: z.string().trim().max(1000).default("").transform((value) => value || null),
});

export type PaymentInput = z.infer<typeof paymentInputSchema>;

// Reading

export async function getInvoice(id: string) {
  const db = getDb();
  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), isNull(invoices.deletedAt))).limit(1);
  if (!invoice) return null;
  const [items, paymentRows] = await Promise.all([
    db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id)).orderBy(asc(invoiceItems.sortOrder)),
    db
      .select({ payment: payments, receipt: receipts })
      .from(payments)
      .leftJoin(receipts, eq(receipts.paymentId, payments.id))
      .where(eq(payments.invoiceId, id))
      .orderBy(asc(payments.paidAt), asc(payments.createdAt)),
  ]);
  return { invoice, items, payments: paymentRows };
}

export async function getInvoiceByToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [invoice] = await getDb()
    .select()
    .from(invoices)
    .where(and(eq(invoices.publicToken, token), isNull(invoices.tokenRevokedAt), isNull(invoices.deletedAt)))
    .limit(1);
  if (!invoice || invoice.status === "draft") return null;
  return getInvoice(invoice.id);
}

export async function getReceiptByToken(token: string) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const [row] = await getDb()
    .select({ receipt: receipts, payment: payments, invoice: invoices })
    .from(receipts)
    .innerJoin(payments, eq(payments.id, receipts.paymentId))
    .innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
    .where(and(eq(receipts.publicToken, token), isNull(receipts.tokenRevokedAt)))
    .limit(1);
  return row ?? null;
}

export async function getReceipt(id: string) {
  const [row] = await getDb()
    .select({ receipt: receipts, payment: payments, invoice: invoices })
    .from(receipts)
    .innerJoin(payments, eq(payments.id, receipts.paymentId))
    .innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
    .where(eq(receipts.id, id))
    .limit(1);
  return row ?? null;
}

export async function listInvoices(filter: { status?: string; clientId?: string } = {}) {
  const statuses = filter.status === "open" ? OPEN_STATUSES : filter.status ? [filter.status as Invoice["status"]] : null;
  return getDb()
    .select({ invoice: invoices, clientName: clients.name })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(isNull(invoices.deletedAt), statuses ? inArray(invoices.status, statuses) : undefined, filter.clientId ? eq(invoices.clientId, filter.clientId) : undefined))
    .orderBy(desc(invoices.createdAt))
    .limit(500);
}

// Drafts

interface DraftSource {
  clientId: string;
  clientProjectId?: string | null;
  quoteId?: string | null;
  milestoneId?: string | null;
  kind?: Invoice["kind"];
  /** Deposit share of the quote in percent, for a deposit invoice. */
  depositPercent?: number;
}

/** New draft for a client, prefilled from a quote, a milestone or a deposit when given. */
export async function createInvoiceDraft(source: DraftSource, actor: Actor, tx = getDb()): Promise<string> {
  const [client] = await tx.select().from(clients).where(and(eq(clients.id, source.clientId), isNull(clients.deletedAt))).limit(1);
  if (!client) throw new InvoiceError("Client introuvable.");
  const issuer = await readSettingUncached("issuer");
  const issueDate = today();
  let title = "Prestations";
  let currency: Currency = "USD";
  let locale: "fr" | "en" = "fr";
  let exchangeRate = issuer.exchangeRate ? issuer.exchangeRate.replace(",", ".") : null;
  let lines: { description: string; quantity: string; unitPrice: number }[] = [];
  let discount = 0;
  let taxRate = 0;
  let kind: Invoice["kind"] = source.kind ?? "standard";

  if (source.quoteId) {
    const [quote] = await tx.select().from(quotes).where(eq(quotes.id, source.quoteId)).limit(1);
    if (quote) {
      currency = quote.currency;
      locale = quote.locale === "en" ? "en" : "fr";
      exchangeRate = quote.exchangeRate ?? exchangeRate;
      if (source.depositPercent && source.depositPercent > 0) {
        kind = "deposit";
        const percent = Math.min(100, source.depositPercent);
        title = locale === "fr" ? `Acompte de ${percent}${NBSP}%${NBSP}: ${quote.title}` : `${percent}% deposit: ${quote.title}`;
        lines = [
          {
            description: locale === "fr" ? `Acompte de ${percent} % sur le devis ${quote.number ?? ""}`.trim() : `${percent}% deposit on quote ${quote.number ?? ""}`.trim(),
            quantity: "1",
            unitPrice: Math.round((quote.total * percent) / 100),
          },
        ];
      } else {
        title = quote.title;
        discount = quote.discount;
        taxRate = quote.taxRate;
        const rows = await tx.select().from(quoteItems).where(eq(quoteItems.quoteId, quote.id)).orderBy(asc(quoteItems.sortOrder));
        lines = rows.map((row) => ({ description: row.description, quantity: row.quantity, unitPrice: row.unitPrice }));
      }
    }
  } else if (source.milestoneId) {
    const [row] = await tx
      .select({ milestone: milestones, project: clientProjects })
      .from(milestones)
      .innerJoin(clientProjects, eq(clientProjects.id, milestones.clientProjectId))
      .where(eq(milestones.id, source.milestoneId))
      .limit(1);
    if (row) {
      kind = "milestone";
      currency = row.project.currency;
      title = `${row.project.name}${NBSP}: ${row.milestone.title}`;
      lines = [{ description: row.milestone.title, quantity: "1", unitPrice: row.milestone.amount ?? 0 }];
    }
  } else if (source.clientProjectId) {
    const [project] = await tx.select().from(clientProjects).where(eq(clientProjects.id, source.clientProjectId)).limit(1);
    if (project) {
      currency = project.currency;
      title = project.name;
    }
  }

  const totals = computeTotals(lines, discount, taxRate);
  const [created] = await tx
    .insert(invoices)
    .values({
      kind,
      clientId: client.id,
      clientProjectId: source.clientProjectId ?? null,
      quoteId: source.quoteId ?? null,
      milestoneId: source.milestoneId ?? null,
      recipientName: client.name,
      recipientEmail: client.email,
      recipientPhone: client.whatsapp ?? client.phone,
      recipientAddress: [client.address, client.city, client.country].filter(Boolean).join(", ") || null,
      title,
      locale,
      issueDate,
      dueDate: addDays(issueDate, 15),
      currency,
      exchangeRate,
      ...totals,
      balance: totals.total,
      terms: issuer.invoiceTerms || null,
      publicToken: generateToken(24),
    })
    .returning({ id: invoices.id });
  if (lines.length > 0) {
    await tx
      .insert(invoiceItems)
      .values(lines.map((line, index) => ({ invoiceId: created.id, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, total: lineTotal(line), sortOrder: index })));
  }
  await writeAudit({ actorId: actor.id, action: "invoice.create", entityType: "invoice", entityId: created.id, diff: { kind }, ip: actor.ip, userAgent: actor.userAgent });
  return created.id;
}

export async function saveInvoiceDraft(id: string, input: InvoiceInput, actor: Actor): Promise<void> {
  const db = getDb();
  const totals = computeTotals(input.items, input.discount, input.taxRate);
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: invoices.status }).from(invoices).where(eq(invoices.id, id)).for("update");
    if (!current) throw new InvoiceError("Facture introuvable.");
    if (current.status !== "draft") throw new InvoiceError("Une facture envoyée n'est plus modifiable : annulez-la et créez-en une nouvelle.");
    const { items, discount: _discount, ...fields } = input;
    await tx.update(invoices).set({ ...fields, ...totals, balance: totals.total }).where(eq(invoices.id, id));
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (items.length > 0) {
      await tx
        .insert(invoiceItems)
        .values(items.map((item, index) => ({ invoiceId: id, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, total: lineTotal(item), sortOrder: index })));
    }
  });
  await writeAudit({ actorId: actor.id, action: "invoice.update", entityType: "invoice", entityId: id, diff: { total: totals.total }, ip: actor.ip, userAgent: actor.userAgent });
}

export async function deleteInvoiceDraft(id: string, actor: Actor): Promise<void> {
  const [deleted] = await getDb()
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.status, "draft"), isNull(invoices.number)))
    .returning({ id: invoices.id });
  if (!deleted) throw new InvoiceError("Seul un brouillon jamais envoyé peut être supprimé.");
  await writeAudit({ actorId: actor.id, action: "invoice.delete", entityType: "invoice", entityId: id, ip: actor.ip });
}

/**
 * Issues the invoice: its number is assigned in the same transaction as the
 * status change, so numbers stay unique and without gaps.
 */
export async function issueInvoice(id: string): Promise<Invoice> {
  return getDb().transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, id)).for("update");
    if (!invoice || invoice.deletedAt) throw new InvoiceError("Facture introuvable.");
    if (invoice.status === "cancelled") throw new InvoiceError("Cette facture est annulée.");
    if (invoice.number) return invoice;
    const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` }).from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    if (count === 0) throw new InvoiceError("Ajoutez au moins une ligne avant l'envoi.");
    if (invoice.total <= 0) throw new InvoiceError("Le total de la facture doit être positif.");
    const number = await nextDocumentNumber(tx, "FAC", Number(invoice.issueDate.slice(0, 4)));
    const status = invoice.dueDate < today() ? "overdue" : "sent";
    const [updated] = await tx.update(invoices).set({ number, status, sentAt: new Date(), balance: invoice.total - invoice.amountPaid }).where(eq(invoices.id, id)).returning();
    return updated;
  });
}

function invoiceTexts(invoice: Invoice) {
  const locale: "fr" | "en" = invoice.locale === "en" ? "en" : "fr";
  const total = formatMoney(invoice.total, invoice.currency, locale);
  const balance = formatMoney(invoice.balance, invoice.currency, locale);
  const due = formatDocDate(invoice.dueDate, locale);
  return { locale, total, balance, due };
}

export async function sendInvoiceByEmail(id: string, options: { message?: string; copyToSelf?: boolean; reminder?: boolean }, actor: Actor): Promise<Invoice> {
  const invoice = await issueInvoice(id);
  if (!invoice.recipientEmail) throw new InvoiceError("Ajoutez l'e-mail du destinataire avant l'envoi.");
  const data = await getInvoice(id);
  const { renderInvoicePdf } = await import("@/pdf/render");
  const pdf = await renderInvoicePdf(data!.invoice, data!.items);
  const { locale, total, balance, due } = invoiceTexts(invoice);
  const issuer = await readSettingUncached("issuer");
  const fr = locale === "fr";
  const reminder = options.reminder && invoice.amountPaid < invoice.total;
  const paragraphs = reminder
    ? [
        fr
          ? `Petit rappel : la facture ${invoice.number} (${invoice.title}) présente un solde de ${balance}, ${invoice.status === "overdue" ? `échu depuis le ${due}` : `à régler avant le ${due}`}.`
          : `A quick reminder: invoice ${invoice.number} (${invoice.title}) has a balance of ${balance}, ${invoice.status === "overdue" ? `due since ${due}` : `due by ${due}`}.`,
        fr ? "Si le paiement a déjà été effectué, merci de ne pas tenir compte de ce message." : "If the payment has already been made, please disregard this message.",
      ]
    : [
        fr
          ? `Veuillez trouver ci-joint la facture ${invoice.number} (${invoice.title}) d'un montant de ${total}, à régler avant le ${due}.`
          : `Please find attached invoice ${invoice.number} (${invoice.title}) for ${total}, due by ${due}.`,
      ];
  await sendMail({
    to: invoice.recipientEmail,
    cc: options.copyToSelf && issuer.email ? issuer.email : undefined,
    replyTo: issuer.email || undefined,
    subject: reminder
      ? fr
        ? `Rappel : facture ${invoice.number}`
        : `Reminder: invoice ${invoice.number}`
      : fr
        ? `Facture ${invoice.number} : ${invoice.title}`
        : `Invoice ${invoice.number}: ${invoice.title}`,
    react: createElement(DocumentEmail, {
      preview: fr ? `Facture ${invoice.number}` : `Invoice ${invoice.number}`,
      greeting: fr ? `Bonjour ${invoice.recipientName},` : `Hello ${invoice.recipientName},`,
      paragraphs,
      cta: fr ? "Consulter la facture" : "View the invoice",
      url: publicDocumentUrl(invoice.publicToken),
      help: fr
        ? "Le PDF est joint à ce message. Le lien ci-dessus reste disponible pour le télécharger à nouveau et voir les modalités de paiement."
        : "The PDF is attached. The link above stays available to download it again and see the payment details.",
      locale,
      message: options.message?.trim() || undefined,
    }),
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  await getDb().insert(documentSends).values({ documentType: "invoice", documentId: id, channel: "email", recipient: invoice.recipientEmail, sentBy: actor.id });
  if (reminder) await getDb().update(invoices).set({ lastReminderAt: new Date() }).where(eq(invoices.id, id));
  await writeAudit({ actorId: actor.id, action: reminder ? "invoice.reminder_email" : "invoice.sent_email", entityType: "invoice", entityId: id, ip: actor.ip, userAgent: actor.userAgent });
  return invoice;
}

function fillTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

export async function invoiceWhatsappLink(id: string, actor: Actor, reminder = false): Promise<string> {
  const invoice = await issueInvoice(id);
  if (!invoice.recipientPhone) throw new InvoiceError("Ajoutez le numéro WhatsApp du destinataire.");
  const templates = await readSettingUncached("templates");
  const { locale, total, balance, due } = invoiceTexts(invoice);
  const fr = locale === "fr";
  const fallback = reminder
    ? fr
      ? "Bonjour {client}, petit rappel concernant la facture {numero} : il reste {solde} à régler (échéance le {echeance}). Vous pouvez la consulter ici : {lien}. Merci, Isaac Akonkwa."
      : "Hello {client}, a quick reminder about invoice {numero}: {solde} remains due (due date {echeance}). You can view it here: {lien}. Thank you, Isaac Akonkwa."
    : fr
      ? "Bonjour {client}, voici votre facture {numero} d'un montant de {total}, à régler avant le {echeance}. Vous pouvez la consulter et la télécharger ici : {lien}. Merci, Isaac Akonkwa."
      : "Hello {client}, here is your invoice {numero} for {total}, due by {echeance}. You can view and download it here: {lien}. Thank you, Isaac Akonkwa.";
  const template = (reminder ? templates.whatsappReminder : templates.whatsappInvoice) || fallback;
  const message = fillTemplate(template, {
    client: invoice.recipientName,
    numero: invoice.number!,
    total,
    solde: balance,
    echeance: due,
    devise: invoice.currency,
    lien: publicDocumentUrl(invoice.publicToken),
  });
  const link = whatsappLink(invoice.recipientPhone, message);
  if (!link) throw new InvoiceError("Numéro WhatsApp invalide (format international attendu).");
  await getDb().insert(documentSends).values({ documentType: "invoice", documentId: id, channel: "whatsapp_link", recipient: invoice.recipientPhone, sentBy: actor.id });
  if (reminder) await getDb().update(invoices).set({ lastReminderAt: new Date() }).where(eq(invoices.id, id));
  await writeAudit({ actorId: actor.id, action: reminder ? "invoice.reminder_whatsapp" : "invoice.sent_whatsapp", entityType: "invoice", entityId: id, ip: actor.ip });
  return link;
}

export async function markInvoiceViewed(invoice: Invoice): Promise<void> {
  const db = getDb();
  if (invoice.status === "sent") {
    await db.update(invoices).set({ status: "viewed", viewedAt: new Date() }).where(and(eq(invoices.id, invoice.id), eq(invoices.status, "sent")));
  } else if (!invoice.viewedAt) {
    await db.update(invoices).set({ viewedAt: new Date() }).where(eq(invoices.id, invoice.id));
  }
  await db
    .update(documentSends)
    .set({ openedAt: new Date() })
    .where(and(eq(documentSends.documentType, "invoice"), eq(documentSends.documentId, invoice.id), isNull(documentSends.openedAt)));
}

export async function cancelInvoice(id: string, reason: string, actor: Actor): Promise<void> {
  const [updated] = await getDb()
    .update(invoices)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason.trim().slice(0, 500) || null, balance: 0 })
    .where(and(eq(invoices.id, id), inArray(invoices.status, ["sent", "viewed", "overdue"]), eq(invoices.amountPaid, 0)))
    .returning({ id: invoices.id });
  if (!updated) throw new InvoiceError("Seule une facture envoyée et sans paiement peut être annulée.");
  await writeAudit({ actorId: actor.id, action: "invoice.cancelled", entityType: "invoice", entityId: id, diff: { reason }, ip: actor.ip });
}

/** Status after a payment, from the amounts and the due date. */
export function statusAfterPayment(invoice: Pick<Invoice, "total" | "dueDate">, amountPaid: number, onDate = today()): Invoice["status"] {
  if (amountPaid >= invoice.total) return "paid";
  if (invoice.dueDate < onDate) return "overdue";
  return amountPaid > 0 ? "partially_paid" : "sent";
}

/**
 * Records a full or partial payment. In one transaction: the invoice row is
 * locked, the payment and its numbered receipt are created, and the invoice
 * totals and status are recalculated.
 */
export async function recordPayment(invoiceId: string, input: PaymentInput, actor: Actor): Promise<{ payment: Payment; receipt: Receipt }> {
  const result = await getDb().transaction(async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
    if (!invoice || invoice.deletedAt) throw new InvoiceError("Facture introuvable.");
    if (!OPEN_STATUSES.includes(invoice.status)) throw new InvoiceError("Cette facture n'attend pas de paiement (envoyez-la d'abord).");
    const balance = invoice.total - invoice.amountPaid;
    if (input.amount > balance) throw new InvoiceError(`Le montant dépasse le solde restant (${formatMoney(balance, invoice.currency)}).`);
    const [payment] = await tx
      .insert(payments)
      .values({ invoiceId, amount: input.amount, currency: invoice.currency, method: input.method, reference: input.reference, paidAt: input.paidAt, note: input.note, createdBy: actor.id })
      .returning();
    const number = await nextDocumentNumber(tx, "REC", Number(input.paidAt.slice(0, 4)));
    const [receipt] = await tx.insert(receipts).values({ number, paymentId: payment.id, invoiceId, publicToken: generateToken(24) }).returning();
    const amountPaid = invoice.amountPaid + input.amount;
    const status = statusAfterPayment(invoice, amountPaid);
    await tx
      .update(invoices)
      .set({ amountPaid, balance: invoice.total - amountPaid, status, paidAt: status === "paid" ? new Date() : null })
      .where(eq(invoices.id, invoiceId));
    return { payment, receipt };
  });
  await writeAudit({
    actorId: actor.id,
    action: "invoice.payment",
    entityType: "invoice",
    entityId: invoiceId,
    diff: { amount: input.amount, method: input.method, receipt: result.receipt.number },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return result;
}

export async function sendReceiptByEmail(receiptId: string, actor: Actor): Promise<string> {
  const row = await getReceipt(receiptId);
  if (!row) throw new InvoiceError("Reçu introuvable.");
  const { receipt, payment, invoice } = row;
  if (!invoice.recipientEmail) throw new InvoiceError("Ajoutez l'e-mail du client sur la facture.");
  const { renderReceiptPdf } = await import("@/pdf/render");
  const pdf = await renderReceiptPdf(receipt, payment, invoice);
  const locale = invoice.locale === "en" ? "en" : "fr";
  const fr = locale === "fr";
  const amount = formatMoney(payment.amount, payment.currency, locale);
  const issuer = await readSettingUncached("issuer");
  await sendMail({
    to: invoice.recipientEmail,
    replyTo: issuer.email || undefined,
    subject: fr ? `Reçu ${receipt.number} : paiement de ${amount}` : `Receipt ${receipt.number}: payment of ${amount}`,
    react: createElement(DocumentEmail, {
      preview: fr ? `Reçu ${receipt.number}` : `Receipt ${receipt.number}`,
      greeting: fr ? `Bonjour ${invoice.recipientName},` : `Hello ${invoice.recipientName},`,
      paragraphs: [
        fr
          ? `Merci pour votre paiement de ${amount} reçu le ${formatDocDate(payment.paidAt, locale)} pour la facture ${invoice.number}. Le reçu ${receipt.number} est joint à ce message.`
          : `Thank you for your payment of ${amount} received on ${formatDocDate(payment.paidAt, locale)} for invoice ${invoice.number}. Receipt ${receipt.number} is attached.`,
        invoice.balance > 0
          ? fr
            ? `Solde restant : ${formatMoney(invoice.balance, invoice.currency, locale)}.`
            : `Remaining balance: ${formatMoney(invoice.balance, invoice.currency, locale)}.`
          : fr
            ? "La facture est entièrement réglée."
            : "The invoice is fully paid.",
      ],
      cta: fr ? "Consulter le reçu" : "View the receipt",
      url: publicDocumentUrl(receipt.publicToken),
      help: fr ? "Conservez ce reçu comme preuve de paiement." : "Keep this receipt as proof of payment.",
      locale,
    }),
    attachments: [{ filename: `${receipt.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  await getDb().insert(documentSends).values({ documentType: "receipt", documentId: receipt.id, channel: "email", recipient: invoice.recipientEmail, sentBy: actor.id });
  await writeAudit({ actorId: actor.id, action: "receipt.sent_email", entityType: "invoice", entityId: invoice.id, diff: { receipt: receipt.number }, ip: actor.ip });
  return invoice.recipientEmail;
}

export async function receiptWhatsappLink(receiptId: string, actor: Actor): Promise<string> {
  const row = await getReceipt(receiptId);
  if (!row) throw new InvoiceError("Reçu introuvable.");
  const { receipt, payment, invoice } = row;
  if (!invoice.recipientPhone) throw new InvoiceError("Ajoutez le numéro WhatsApp du client sur la facture.");
  const templates = await readSettingUncached("templates");
  const locale = invoice.locale === "en" ? "en" : "fr";
  const fallback =
    locale === "fr"
      ? "Bonjour {client}, merci pour votre paiement de {montant} (facture {facture}). Voici votre reçu {numero} : {lien}. Isaac Akonkwa."
      : "Hello {client}, thank you for your payment of {montant} (invoice {facture}). Here is your receipt {numero}: {lien}. Isaac Akonkwa.";
  const message = fillTemplate(templates.whatsappReceipt || fallback, {
    client: invoice.recipientName,
    montant: formatMoney(payment.amount, payment.currency, locale),
    facture: invoice.number ?? "",
    numero: receipt.number,
    solde: formatMoney(invoice.balance, invoice.currency, locale),
    lien: publicDocumentUrl(receipt.publicToken),
  });
  const link = whatsappLink(invoice.recipientPhone, message);
  if (!link) throw new InvoiceError("Numéro WhatsApp invalide (format international attendu).");
  await getDb().insert(documentSends).values({ documentType: "receipt", documentId: receipt.id, channel: "whatsapp_link", recipient: invoice.recipientPhone, sentBy: actor.id });
  return link;
}

/** Nightly: open invoices past their due date become overdue. */
export async function markOverdueInvoices(): Promise<number> {
  const rows = await getDb()
    .update(invoices)
    .set({ status: "overdue" })
    .where(and(inArray(invoices.status, ["sent", "viewed", "partially_paid"]), lt(invoices.dueDate, today()), isNull(invoices.deletedAt)))
    .returning({ id: invoices.id });
  return rows.length;
}

/** Open invoices due within the next days, for reminders and the daily digest. */
export async function invoicesDueSoon(days: number) {
  return getDb()
    .select()
    .from(invoices)
    .where(and(inArray(invoices.status, ["sent", "viewed", "partially_paid"]), gte(invoices.dueDate, today()), lte(invoices.dueDate, addDays(today(), days)), isNull(invoices.deletedAt)))
    .orderBy(asc(invoices.dueDate));
}

// Reports: USD and CDF are always kept apart.

export async function billingReport(months = 12) {
  const db = getDb();
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - (months - 1), 1);
  const sinceDate = since.toISOString().slice(0, 10);
  const [monthly, outstanding, topClients, byMethod] = await Promise.all([
    db.execute<{ month: string; currency: Currency; amount: number; count: number }>(sql`
      select to_char(date_trunc('month', paid_at), 'YYYY-MM') as month, currency, sum(amount)::int as amount, count(*)::int as count
      from payments where paid_at >= ${sinceDate}
      group by 1, 2 order by 1
    `),
    db.execute<{ currency: Currency; amount: number; overdue: number; count: number }>(sql`
      select currency, sum(balance)::int as amount,
        coalesce(sum(balance) filter (where status = 'overdue'), 0)::int as overdue,
        count(*)::int as count
      from invoices where deleted_at is null and status in ('sent', 'viewed', 'partially_paid', 'overdue')
      group by currency
    `),
    db.execute<{ client_id: string; name: string; currency: Currency; amount: number }>(sql`
      select c.id as client_id, c.name, p.currency, sum(p.amount)::int as amount
      from payments p join invoices i on i.id = p.invoice_id join clients c on c.id = i.client_id
      where p.paid_at >= ${sinceDate}
      group by c.id, c.name, p.currency order by amount desc limit 20
    `),
    db.execute<{ method: PaymentMethod; currency: Currency; amount: number }>(sql`
      select method, currency, sum(amount)::int as amount from payments where paid_at >= ${sinceDate} group by method, currency
    `),
  ]);
  return { sinceDate, monthly: [...monthly], outstanding: [...outstanding], topClients: [...topClients], byMethod: [...byMethod] };
}

/** CSV export of invoices, one line per invoice, amounts in their own currency. */
export async function invoicesCsv(): Promise<string> {
  const rows = await getDb()
    .select({ invoice: invoices, clientName: clients.name })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(isNull(invoices.deletedAt), sql`${invoices.number} is not null`))
    .orderBy(asc(invoices.issueDate));
  const escape = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    // Formula injection guard for spreadsheet software.
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[";\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const amount = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const header = ["Numéro", "Date", "Échéance", "Client", "Objet", "Devise", "Total", "Payé", "Solde", "Statut"];
  const lines = rows.map(({ invoice, clientName }) =>
    [
      invoice.number,
      invoice.issueDate,
      invoice.dueDate,
      clientName,
      invoice.title,
      invoice.currency,
      amount(invoice.total),
      amount(invoice.amountPaid),
      amount(invoice.balance),
      INVOICE_STATUS_LABELS[invoice.status],
    ]
      .map(escape)
      .join(";"),
  );
  return `\u{FEFF}${[header.join(";"), ...lines].join("\r\n")}\r\n`;
}

export type InvoiceWithItems = { invoice: Invoice; items: InvoiceItem[] };

// Engagement: the quote (or project budget) followed until it is fully paid.

export interface EngagementSummary {
  kind: "quote" | "project";
  label: string;
  currency: Currency;
  /** Total to pay for the whole engagement. */
  total: number;
  /** Issued invoices (drafts and cancelled ones excluded). */
  invoiced: number;
  /** Payments received on every invoice of the engagement. */
  paid: number;
  remaining: number;
  /** Amount still to invoice, drafts included, so nothing is billed twice. */
  toInvoice: number;
  invoices: Pick<Invoice, "id" | "number" | "kind" | "title" | "status" | "total" | "amountPaid" | "balance" | "issueDate">[];
  quoteId: string | null;
  clientProjectId: string | null;
}

/**
 * Totals of the quote (or, without quote, of the project budget) an invoice
 * belongs to. Only amounts in the same currency are counted.
 */
export async function engagementSummary(invoice: Pick<Invoice, "quoteId" | "clientProjectId" | "currency">): Promise<EngagementSummary | null> {
  const db = getDb();
  let kind: EngagementSummary["kind"];
  let total: number;
  let label: string;
  let quoteId: string | null = null;
  let clientProjectId: string | null = invoice.clientProjectId;
  if (invoice.quoteId) {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, invoice.quoteId)).limit(1);
    if (!quote || quote.currency !== invoice.currency) return null;
    kind = "quote";
    total = quote.total;
    label = quote.number ? `${quote.number} : ${quote.title}` : quote.title;
    quoteId = quote.id;
    clientProjectId = quote.clientProjectId ?? clientProjectId;
  } else if (invoice.clientProjectId) {
    const [project] = await db.select().from(clientProjects).where(eq(clientProjects.id, invoice.clientProjectId)).limit(1);
    if (!project?.budget || project.currency !== invoice.currency) return null;
    kind = "project";
    total = project.budget;
    label = project.name;
  } else {
    return null;
  }
  const rows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      kind: invoices.kind,
      title: invoices.title,
      status: invoices.status,
      total: invoices.total,
      amountPaid: invoices.amountPaid,
      balance: invoices.balance,
      issueDate: invoices.issueDate,
    })
    .from(invoices)
    .where(
      and(
        isNull(invoices.deletedAt),
        eq(invoices.currency, invoice.currency),
        quoteId ? eq(invoices.quoteId, quoteId) : eq(invoices.clientProjectId, clientProjectId!),
      ),
    )
    .orderBy(asc(invoices.issueDate), asc(invoices.createdAt));
  const issued = rows.filter((row) => row.status !== "draft" && row.status !== "cancelled");
  const invoiced = issued.reduce((sum, row) => sum + row.total, 0);
  const paid = rows.reduce((sum, row) => sum + (row.status === "cancelled" ? 0 : row.amountPaid), 0);
  const committed = rows.filter((row) => row.status !== "cancelled").reduce((sum, row) => sum + row.total, 0);
  return {
    kind,
    label,
    currency: invoice.currency,
    total,
    invoiced,
    paid,
    remaining: Math.max(0, total - paid),
    toInvoice: Math.max(0, total - committed),
    invoices: rows,
    quoteId,
    clientProjectId,
  };
}

/** Draft invoice for what remains to invoice on a quote or project (deposit already billed). */
export async function createBalanceInvoice(fromInvoiceId: string, actor: Actor): Promise<string> {
  const data = await getInvoice(fromInvoiceId);
  if (!data) throw new InvoiceError("Facture introuvable.");
  const summary = await engagementSummary(data.invoice);
  if (!summary) throw new InvoiceError("Cette facture n'est rattachée à aucun devis ni budget de projet.");
  if (summary.toInvoice <= 0) throw new InvoiceError("Tout le montant prévu est déjà facturé.");
  const locale = data.invoice.locale === "en" ? "en" : "fr";
  const fr = locale === "fr";
  const id = await createInvoiceDraft({ clientId: data.invoice.clientId, clientProjectId: summary.clientProjectId }, actor);
  const issuer = await readSettingUncached("issuer");
  await getDb().transaction(async (tx) => {
    const line = {
      description: fr ? `Solde ${summary.kind === "quote" ? "du devis" : "du projet"} ${summary.label}` : `Balance of ${summary.label}`,
      quantity: "1",
      unitPrice: summary.toInvoice,
    };
    await tx
      .update(invoices)
      .set({
        quoteId: summary.quoteId,
        title: fr ? `Solde : ${summary.label}` : `Balance: ${summary.label}`,
        locale,
        currency: summary.currency,
        exchangeRate: data.invoice.exchangeRate,
        subtotal: summary.toInvoice,
        total: summary.toInvoice,
        balance: summary.toInvoice,
        terms: data.invoice.terms ?? (issuer.invoiceTerms || null),
      })
      .where(eq(invoices.id, id));
    await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id));
    await tx.insert(invoiceItems).values({ invoiceId: id, ...line, total: summary.toInvoice, sortOrder: 0 });
  });
  await writeAudit({ actorId: actor.id, action: "invoice.balance", entityType: "invoice", entityId: id, diff: { from: fromInvoiceId, amount: summary.toInvoice }, ip: actor.ip });
  return id;
}

/** Rows printed on invoices and receipts: the whole engagement until it is cleared. */
export function engagementRows(summary: EngagementSummary, locale: "fr" | "en") {
  const fr = locale === "fr";
  return {
    title: fr ? `Suivi des paiements : ${summary.label}` : `Payment tracking: ${summary.label}`,
    rows: [
      { label: fr ? (summary.kind === "quote" ? "Montant total du devis" : "Budget total du projet") : "Total amount", amount: summary.total },
      { label: fr ? "Total réglé à ce jour (tous paiements)" : "Paid to date (all payments)", amount: summary.paid },
      { label: fr ? "Reste à payer" : "Remaining to pay", amount: summary.remaining, strong: true },
    ],
  };
}
