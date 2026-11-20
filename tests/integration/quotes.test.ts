import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/server/db";
import { clients, documentSends, quotes, users } from "@/server/db/schema";
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

    const clientId = await convertQuote(id, user);
    const [client] = await getDb().select().from(clients).where(eq(clients.id, clientId));
    expect(client.name).toBe("Coop Kivu");
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
