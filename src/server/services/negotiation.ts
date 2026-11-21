import { createElement } from "react";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { AdminNotificationEmail, DocumentEmail } from "@/emails/templates";
import { formatMoney, parseMoney } from "@/lib/money";
import { getSiteUrl } from "@/lib/site";
import { z } from "@/lib/zod";
import { consumeRateLimit } from "../auth/rate-limit";
import { readSettingUncached } from "../content/settings-store";
import { getDb } from "../db";
import { quoteNegotiations, quotes, type Quote, type QuoteNegotiation } from "../db/schema";
import { renderMail, sendMailOrQueue } from "../mail/send";
import { writeAudit } from "./audit";
import type { RequestMeta } from "./inbox";
import { notifyAdmins } from "./notifications";
import { QuoteError, addDays, duplicateQuote, getQuoteByToken, isExpired, publicQuoteUrl, today, type Actor } from "./quotes";

/** Statuses in which the client can still negotiate, accept or decline. */
export const OPEN_QUOTE_STATUSES: Quote["status"][] = ["sent", "viewed", "negotiating"];

export const negotiationInputSchema = z.object({
  proposedTotal: z
    .string()
    .trim()
    .max(30)
    .default("")
    .transform((value, context) => {
      if (!value) return null;
      const cents = parseMoney(value);
      if (cents === null || cents <= 0) {
        context.addIssue({ code: "custom", message: "invalidAmount" });
        return z.NEVER;
      }
      return cents;
    }),
  requestedFeatures: z.string().trim().max(3000).default("").transform((value) => value || null),
  message: z.string().trim().min(10, "tooShort").max(3000),
  name: z.string().trim().max(160).default("").transform((value) => value || null),
});

export type NegotiationInput = z.infer<typeof negotiationInputSchema>;

export type NegotiationResult = { ok: true } | { ok: false; error: "invalid" | "closed" | "expired" | "rateLimited" };

/** Client proposal from the public quote page: another budget, more features, or both. */
export async function proposeNegotiation(token: string, input: NegotiationInput, meta: RequestMeta): Promise<NegotiationResult> {
  const found = await getQuoteByToken(token);
  if (!found) return { ok: false, error: "invalid" };
  const { quote } = found;
  if (!OPEN_QUOTE_STATUSES.includes(quote.status)) return { ok: false, error: "closed" };
  if (isExpired(quote)) return { ok: false, error: "expired" };
  const limit = await consumeRateLimit(`negotiation:${quote.id}`, { limit: 5, windowSeconds: 86_400 });
  if (!limit.allowed) return { ok: false, error: "rateLimited" };

  const db = getDb();
  await db.insert(quoteNegotiations).values({
    quoteId: quote.id,
    author: "client",
    authorName: input.name ?? quote.recipientName,
    proposedTotal: input.proposedTotal,
    requestedFeatures: input.requestedFeatures,
    message: input.message,
    ip: meta.ip,
  });
  await db
    .update(quotes)
    .set({ status: "negotiating" })
    .where(and(eq(quotes.id, quote.id), inArray(quotes.status, OPEN_QUOTE_STATUSES)));
  await writeAudit({ actorId: null, action: "quote.negotiation", entityType: "quote", entityId: quote.id, diff: { proposedTotal: input.proposedTotal }, ...meta });

  const url = new URL(`/admin/devis/emis/${quote.id}`, getSiteUrl()).toString();
  const fields: [string, string][] = [
    ["Devis", quote.number ?? ""],
    ["Client", quote.recipientName],
    ["Montant du devis", formatMoney(quote.total, quote.currency)],
    ...(input.proposedTotal ? ([["Budget proposé", formatMoney(input.proposedTotal, quote.currency)]] as [string, string][]) : []),
  ];
  const body = [input.message, input.requestedFeatures ? `Fonctionnalités souhaitées :\n${input.requestedFeatures}` : ""].filter(Boolean).join("\n\n");
  await notifyAdmins({ type: "quote_negotiation", title: `Négociation sur le devis ${quote.number}`, body: `${quote.recipientName} propose ${input.proposedTotal ? formatMoney(input.proposedTotal, quote.currency) : "des ajustements"}.`, url: `/admin/devis/emis/${quote.id}` });
  const to = process.env.ADMIN_EMAIL || (await readSettingUncached("issuer")).email;
  if (to) {
    const mail = await renderMail(createElement(AdminNotificationEmail, { title: "Nouvelle proposition sur un devis", fields, body, url }));
    await sendMailOrQueue({ to, subject: `[Devis] Négociation : ${quote.number}`, replyTo: quote.recipientEmail ?? undefined, ...mail });
  }
  return { ok: true };
}

async function mailClient(quote: Quote, message: string, opening: string) {
  if (!quote.recipientEmail) return;
  const locale = quote.locale === "en" ? "en" : "fr";
  const fr = locale === "fr";
  const issuer = await readSettingUncached("issuer");
  const mail = await renderMail(
    createElement(DocumentEmail, {
      preview: fr ? `Devis ${quote.number}` : `Quote ${quote.number}`,
      greeting: fr ? `Bonjour ${quote.recipientName},` : `Hello ${quote.recipientName},`,
      paragraphs: [opening],
      message,
      cta: fr ? "Voir le devis" : "View the quote",
      url: publicQuoteUrl(quote.publicToken),
      help: fr ? "Vous pouvez accepter le devis, le refuser ou faire une nouvelle proposition depuis cette page." : "You can accept, decline or make a new proposal from this page.",
      locale,
    }),
  );
  await sendMailOrQueue({ to: quote.recipientEmail, replyTo: issuer.email || undefined, subject: fr ? `Votre devis ${quote.number}` : `Your quote ${quote.number}`, ...mail });
}

/**
 * Answer that keeps the quote unchanged: the client sees the reply and can
 * accept, decline or negotiate again. The validity is extended if needed.
 */
export async function replyToNegotiation(quoteId: string, message: string, actor: Actor): Promise<void> {
  const text = message.trim().slice(0, 3000);
  if (text.length < 5) throw new QuoteError("Écrivez une réponse.");
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), isNull(quotes.deletedAt))).limit(1);
  if (!quote || !OPEN_QUOTE_STATUSES.includes(quote.status)) throw new QuoteError("Ce devis n'est pas en cours de négociation.");
  const issuer = await readSettingUncached("issuer");
  const validUntil = quote.validUntil < today() ? addDays(today(), issuer.quoteValidityDays) : quote.validUntil;
  await db.insert(quoteNegotiations).values({ quoteId, author: "admin", authorName: issuer.name, message: text });
  const [updated] = await db.update(quotes).set({ status: "sent", validUntil }).where(eq(quotes.id, quoteId)).returning();
  const fr = quote.locale !== "en";
  await mailClient(
    updated,
    text,
    fr ? `Merci pour votre proposition concernant le devis ${quote.number}. Voici ma réponse :` : `Thank you for your proposal about quote ${quote.number}. Here is my answer:`,
  );
  await writeAudit({ actorId: actor.id, action: "quote.negotiation_reply", entityType: "quote", entityId: quoteId, ip: actor.ip });
}

/**
 * New version of a quote after a negotiation: a draft copy linked to the
 * previous one. Sending it replaces the previous version for the client.
 */
export async function reviseQuote(quoteId: string, actor: Actor): Promise<string> {
  const db = getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote || !OPEN_QUOTE_STATUSES.includes(quote.status)) throw new QuoteError("Seul un devis ouvert peut être révisé.");
  const [pending] = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(and(eq(quotes.parentQuoteId, quoteId), eq(quotes.status, "draft"), isNull(quotes.deletedAt)))
    .limit(1);
  if (pending) return pending.id;
  const copyId = await duplicateQuote(quoteId, actor);
  await db
    .update(quotes)
    .set({ parentQuoteId: quoteId, revision: quote.revision + 1, clientProjectId: quote.clientProjectId })
    .where(eq(quotes.id, copyId));
  await writeAudit({ actorId: actor.id, action: "quote.revision", entityType: "quote", entityId: copyId, diff: { from: quoteId }, ip: actor.ip });
  return copyId;
}

/** Ancestors of a quote, oldest first, then the quote itself. */
async function chain(quote: Quote): Promise<Quote[]> {
  const db = getDb();
  const result: Quote[] = [quote];
  let current = quote;
  for (let guard = 0; current.parentQuoteId && guard < 30; guard += 1) {
    const [parent] = await db.select().from(quotes).where(eq(quotes.id, current.parentQuoteId)).limit(1);
    if (!parent) break;
    result.unshift(parent);
    current = parent;
  }
  return result;
}

export interface ThreadEntry extends QuoteNegotiation {
  quoteNumber: string | null;
  revision: number;
}

/** Whole negotiation across the versions of a quote, oldest first. */
export async function negotiationThread(quote: Quote): Promise<ThreadEntry[]> {
  const versions = await chain(quote);
  const rows = await getDb()
    .select()
    .from(quoteNegotiations)
    .where(inArray(quoteNegotiations.quoteId, versions.map((version) => version.id)))
    .orderBy(asc(quoteNegotiations.createdAt));
  const byId = new Map(versions.map((version) => [version.id, version]));
  return rows.map((row) => ({ ...row, quoteNumber: byId.get(row.quoteId)?.number ?? null, revision: byId.get(row.quoteId)?.revision ?? 1 }));
}

/** Latest sent version that replaces a revised quote, for the link on its public page. */
export async function latestRevision(quoteId: string): Promise<Quote | null> {
  const [child] = await getDb()
    .select()
    .from(quotes)
    .where(and(eq(quotes.parentQuoteId, quoteId), ne(quotes.status, "draft"), isNull(quotes.deletedAt)))
    .orderBy(desc(quotes.revision))
    .limit(1);
  if (!child) return null;
  return child.status === "revised" ? ((await latestRevision(child.id)) ?? child) : child;
}
