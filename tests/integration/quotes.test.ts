import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db";
import { clients, documentSends, quotes, users, clientProjects, invoices, milestones } from "@/server/db/schema";
import { renderQuotePdf } from "@/pdf/render";
import { nextDocumentNumber } from "@/server/services/sequences";
import {
  acceptQuote,
  convertQuote,
  createQuoteDraft,
  declineQuote,
  expireQuotes,
  getQuote,
  getQuoteByToken,
  prepareWhatsappSend,
  quoteInputSchema,
  saveQuoteDraft,
  sendQuoteByEmail,
} from "@/server/services/quotes";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";
import { clearOutbox, readOutbox } from "./helpers-mail";

const meta = { ip: "203.0.113.40", userAgent: "vitest" };

async function actor() {
  const [user] = await getDb().insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
  return { id: user.id, ...meta };
}

function input(overrides: Record<string, unknown> = {}) {
  return quoteInputSchema.parse({
    title: "Application mobile",
    recipientName: "Coop Kivu",
    recipientEmail: "coop@example.test",
    recipientPhone: "+243 970 000 000",
    locale: "fr",
    currency: "USD",
    issueDate: "2026-11-20",
    validUntil: "2099-12-20",
    exchangeRate: "2800",
    discount: "100",
    taxRate: "16",
    notes: "",
    terms: "Acompte de 40 % à la commande.",
    items: [
      { description: "Conception", quantity: "1", unitPrice: "1 200" },
      { description: "Développement", quantity: "10", unitPrice: "150,50" },
      { description: "", quantity: "1", unitPrice: "" },
    ],
    ...overrides,
  });
}

describe("quote input", () => {
  it("parses French amounts, ignores empty lines and rejects bad values", () => {
    const parsed = input();
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[1]).toEqual({ description: "Développement", quantity: "10", unitPrice: 15050 });
    expect(parsed.discount).toBe(10000);
    expect(parsed.taxRate).toBe(1600);
    expect(() => input({ items: [{ description: "X", quantity: "-1", unitPrice: "10" }] })).toThrow();
    expect(() => input({ validUntil: "2026-01-01" })).toThrow();
  });
});

describe.skipIf(!hasTestDatabase)("quotes", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    await clearOutbox();
  });
  afterAll(closeDb);

  it("saves a draft with computed totals", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    const { quote, items } = (await getQuote(id))!;
    expect(items.map((item) => item.total)).toEqual([120000, 150500]);
    expect(quote.subtotal).toBe(270500);
    expect(quote.total).toBe(Math.round((270500 - 10000) * 1.16));
    expect(quote.number).toBeNull();
  });

  it("numbers documents without duplicates or gaps under concurrency", async () => {
    const numbers = await Promise.all(
      Array.from({ length: 12 }, () => getDb().transaction((tx) => nextDocumentNumber(tx, "DEV", 2031))),
    );
    expect(new Set(numbers).size).toBe(12);
    expect([...numbers].sort().at(-1)).toBe("DEV-2031-0012");
  });

  it("sends by e-mail with the PDF, then locks the quote", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    const sent = await sendQuoteByEmail(id, { message: "Voici la proposition." }, user);
    expect(sent.number).toMatch(/^DEV-2026-\d{4}$/);
    expect(sent.status).toBe("sent");

    const [mail] = await readOutbox();
    expect(mail).toContain("To: coop@example.test");
    expect(mail).toContain(`filename=${sent.number}.pdf`);
    await expect(saveQuoteDraft(id, input(), user)).rejects.toThrow("n'est plus modifiable");

    const resent = await sendQuoteByEmail(id, {}, user);
    expect(resent.number).toBe(sent.number);
    const sends = await getDb().select().from(documentSends).where(eq(documentSends.documentId, id));
    expect(sends).toHaveLength(2);
  });

  it("renders a valid PDF", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    const { quote, items } = (await getQuote(id))!;
    const pdf = await renderQuotePdf(quote, items);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1500);
  });

  it("builds a WhatsApp link pointing to the public page", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    const link = await prepareWhatsappSend(id, user);
    expect(link.startsWith("https://wa.me/243970000000?text=")).toBe(true);
    const { quote } = (await getQuote(id))!;
    expect(decodeURIComponent(link)).toContain(`/f/${quote.publicToken}`);
    expect(decodeURIComponent(link)).toContain(quote.number!);
  });

  it("accepts online once, records the signer and converts to a client", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    const { quote: draft } = (await getQuote(id))!;
    expect(await getQuoteByToken(draft.publicToken)).toBeNull();
    await sendQuoteByEmail(id, {}, user);

    expect(await acceptQuote(draft.publicToken, "A", meta)).toEqual({ ok: false, error: "name" });
    expect(await acceptQuote("x".repeat(32), "Amani", meta)).toEqual({ ok: false, error: "invalid" });
    expect(await acceptQuote(draft.publicToken, "Amani Bahati", meta)).toEqual({ ok: true });
    expect(await acceptQuote(draft.publicToken, "Amani Bahati", meta)).toEqual({ ok: false, error: "closed" });
    expect(await declineQuote(draft.publicToken, meta)).toEqual({ ok: false, error: "closed" });

    const [accepted] = await getDb().select().from(quotes).where(eq(quotes.id, id));
    expect(accepted.acceptedBy).toBe("Amani Bahati");
    expect(accepted.acceptedIp).toBe(meta.ip);

    const result = await convertQuote(id, user, { depositPercent: 30, milestones: true });
    const [client] = await getDb().select().from(clients).where(eq(clients.id, result.clientId));
    expect(client.name).toBe("Coop Kivu");
    const [project] = await getDb().select().from(clientProjects).where(eq(clientProjects.id, result.projectId));
    expect(project.clientId).toBe(result.clientId);
    expect(project.budget).toBe(accepted.total);
    const projectMilestones = await getDb().select().from(milestones).where(eq(milestones.clientProjectId, result.projectId));
    expect(projectMilestones.length).toBeGreaterThan(0);
    const [deposit] = await getDb().select().from(invoices).where(eq(invoices.id, result.invoiceId!));
    expect(deposit.kind).toBe("deposit");
    expect(deposit.status).toBe("draft");
    expect(deposit.total).toBe(Math.round(accepted.total * 0.3));
    // Converting twice never duplicates the project.
    expect((await convertQuote(id, user)).projectId).toBe(result.projectId);
  });

  it("follows a deposit until the whole quote is paid", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    const { quote: draft } = (await getQuote(id))!;
    await sendQuoteByEmail(id, {}, user);
    await acceptQuote(draft.publicToken, "Amani Bahati", meta);
    const { invoiceId } = await convertQuote(id, user, { depositPercent: 40 });
    const { quote } = (await getQuote(id))!;
    const deposit = Math.round(quote.total * 0.4);

    const { sendInvoiceByEmail, recordPayment, paymentInputSchema, engagementSummary, createBalanceInvoice, getInvoice } = await import("@/server/services/invoices");
    await sendInvoiceByEmail(invoiceId!, {}, user);
    await recordPayment(invoiceId!, paymentInputSchema.parse({ amount: String(deposit / 100), method: "mpesa", reference: "", paidAt: "2026-11-20", note: "" }), user);
    const { invoice } = (await getInvoice(invoiceId!))!;
    expect(invoice.status).toBe("paid");

    let summary = (await engagementSummary(invoice))!;
    expect(summary.total).toBe(quote.total);
    expect(summary.paid).toBe(deposit);
    expect(summary.remaining).toBe(quote.total - deposit);
    expect(summary.toInvoice).toBe(quote.total - deposit);

    const balanceId = await createBalanceInvoice(invoiceId!, user);
    const balance = (await getInvoice(balanceId))!;
    expect(balance.invoice.total).toBe(quote.total - deposit);
    expect(balance.invoice.quoteId).toBe(id);
    summary = (await engagementSummary(invoice))!;
    expect(summary.toInvoice).toBe(0);
    await expect(createBalanceInvoice(invoiceId!, user)).rejects.toThrow(/déjà facturé/);

    await sendInvoiceByEmail(balanceId, {}, user);
    await recordPayment(balanceId, paymentInputSchema.parse({ amount: String((quote.total - deposit) / 100), method: "cash", reference: "", paidAt: "2026-11-20", note: "" }), user);
    summary = (await engagementSummary(invoice))!;
    expect(summary.paid).toBe(quote.total);
    expect(summary.remaining).toBe(0);
  });

  it("negotiates until a revised quote is accepted", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input(), user);
    await sendQuoteByEmail(id, {}, user);
    const { quote } = (await getQuote(id))!;
    const neg = await import("@/server/services/negotiation");
    const { notifications } = await import("@/server/db/schema");

    const proposal = neg.negotiationInputSchema.parse({ proposedTotal: "2 000", requestedFeatures: "Paiement Mobile Money", message: "Notre budget est plus serré, est-ce possible ?" });
    expect(await neg.proposeNegotiation(quote.publicToken, proposal, meta)).toEqual({ ok: true });
    let current = (await getQuote(id))!.quote;
    expect(current.status).toBe("negotiating");
    expect((await getDb().select().from(notifications)).some((row) => row.type === "quote_negotiation")).toBe(true);
    expect(() => neg.negotiationInputSchema.parse({ message: "court" })).toThrow();

    await clearOutbox();
    await neg.replyToNegotiation(id, "Je peux retirer la formation pour réduire le coût.", user);
    current = (await getQuote(id))!.quote;
    expect(current.status).toBe("sent");
    expect((await readOutbox())[0]).toContain("retirer la formation");

    await neg.proposeNegotiation(quote.publicToken, neg.negotiationInputSchema.parse({ message: "D'accord, pouvez-vous envoyer une nouvelle version ?" }), meta);
    const revisionId = await neg.reviseQuote(id, user);
    expect(await neg.reviseQuote(id, user)).toBe(revisionId);
    const revision = (await getQuote(revisionId))!.quote;
    expect(revision.parentQuoteId).toBe(id);
    expect(revision.revision).toBe(2);
    await saveQuoteDraft(revisionId, input({ items: [{ description: "Application sans formation", quantity: "1", unitPrice: "2 000" }], discount: "", taxRate: "" }), user);
    await sendQuoteByEmail(revisionId, {}, user);

    expect((await getQuote(id))!.quote.status).toBe("revised");
    expect((await neg.latestRevision(id))?.id).toBe(revisionId);
    expect(await acceptQuote(quote.publicToken, "Amani Bahati", meta)).toEqual({ ok: false, error: "closed" });
    const sent = (await getQuote(revisionId))!.quote;
    const thread = await neg.negotiationThread(sent);
    expect(thread.map((entry) => entry.author)).toEqual(["client", "admin", "client"]);
    expect(await acceptQuote(sent.publicToken, "Amani Bahati", meta)).toEqual({ ok: true });
  });

  it("expires quotes past their validity", async () => {
    const user = await actor();
    const id = await createQuoteDraft({}, user);
    await saveQuoteDraft(id, input({ issueDate: "2020-01-01", validUntil: "2020-02-01" }), user);
    await sendQuoteByEmail(id, {}, user);
    const { quote } = (await getQuote(id))!;
    expect(await acceptQuote(quote.publicToken, "Amani", meta)).toEqual({ ok: false, error: "expired" });
    expect(await expireQuotes()).toBe(1);
    expect((await getQuote(id))!.quote.status).toBe("expired");
  });
});
