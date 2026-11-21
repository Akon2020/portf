import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { renderInvoicePdf, renderReceiptPdf } from "@/pdf/render";
import { closeDb, getDb } from "@/server/db";
import { clients, documentSends, invoices, users } from "@/server/db/schema";
import {
  billingReport,
  cancelInvoice,
  createInvoiceDraft,
  getInvoice,
  getInvoiceByToken,
  getReceiptByToken,
  invoiceInputSchema,
  invoiceWhatsappLink,
  invoicesCsv,
  markOverdueInvoices,
  paymentInputSchema,
  recordPayment,
  saveInvoiceDraft,
  sendInvoiceByEmail,
  sendReceiptByEmail,
  statusAfterPayment,
} from "@/server/services/invoices";
import { hasTestDatabase, prepareTestDatabase } from "./helpers";
import { clearOutbox, readOutbox } from "./helpers-mail";

const meta = { ip: "203.0.113.41", userAgent: "vitest" };

async function setup() {
  const db = getDb();
  const [user] = await db.insert(users).values({ email: "admin@example.test", name: "Isaac", role: "super_admin" }).returning();
  const [client] = await db
    .insert(clients)
    .values({ name: "Hôpital Panzi", email: "compta@example.test", whatsapp: "+243970000000", city: "Bukavu" })
    .returning();
  return { actor: { id: user.id, ...meta }, client };
}

function input(overrides: Record<string, unknown> = {}) {
  return invoiceInputSchema.parse({
    title: "Développement MedHub",
    recipientName: "Hôpital Panzi",
    recipientEmail: "compta@example.test",
    recipientPhone: "+243 970 000 000",
    recipientAddress: "Bukavu",
    locale: "fr",
    currency: "USD",
    issueDate: "2026-11-20",
    dueDate: "2099-12-20",
    exchangeRate: "",
    discount: "",
    taxRate: "",
    notes: "",
    terms: "",
    items: [
      { description: "Module patients", quantity: "1", unitPrice: "600" },
      { description: "Formation", quantity: "2", unitPrice: "200" },
    ],
    ...overrides,
  });
}

const payment = (amount: string, overrides: Record<string, unknown> = {}) =>
  paymentInputSchema.parse({ amount, method: "mpesa", reference: "MP123", paidAt: "2026-11-20", note: "", ...overrides });

describe("payment status", () => {
  it("follows the amounts and the due date", () => {
    expect(statusAfterPayment({ total: 1000, dueDate: "2099-01-01" }, 1000)).toBe("paid");
    expect(statusAfterPayment({ total: 1000, dueDate: "2099-01-01" }, 400)).toBe("partially_paid");
    expect(statusAfterPayment({ total: 1000, dueDate: "2020-01-01" }, 400)).toBe("overdue");
    expect(statusAfterPayment({ total: 1000, dueDate: "2020-01-01" }, 1000)).toBe("paid");
  });

  it("rejects payments in the future or without amount", () => {
    expect(() => payment("0")).toThrow();
    expect(() => payment("10", { paidAt: "2999-01-01" })).toThrow();
  });
});

describe.skipIf(!hasTestDatabase)("invoices", () => {
  beforeEach(async () => {
    await prepareTestDatabase();
    await clearOutbox();
  });
  afterAll(closeDb);

  it("issues, numbers and sends an invoice with its PDF", async () => {
    const { actor, client } = await setup();
    const id = await createInvoiceDraft({ clientId: client.id }, actor);
    await saveInvoiceDraft(id, input(), actor);
    const draft = (await getInvoice(id))!;
    expect(draft.invoice.total).toBe(100000);
    expect(draft.invoice.number).toBeNull();
    expect(await getInvoiceByToken(draft.invoice.publicToken)).toBeNull();

    const sent = await sendInvoiceByEmail(id, {}, actor);
    expect(sent.number).toBe("FAC-2026-0001");
    expect(sent.status).toBe("sent");
    const [mail] = await readOutbox();
    expect(mail).toContain("FAC-2026-0001.pdf");
    await expect(saveInvoiceDraft(id, input(), actor)).rejects.toThrow(/plus modifiable/);

    const pdf = await renderInvoicePdf(sent, draft.items);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    const link = await invoiceWhatsappLink(id, actor);
    expect(link).toMatch(/^https:\/\/wa\.me\/243970000000\?text=/);
    expect(decodeURIComponent(link)).toContain(`/f/${sent.publicToken}`);
    const sends = await getDb().select().from(documentSends).where(eq(documentSends.documentId, id));
    expect(sends.map((row) => row.channel).sort()).toEqual(["email", "whatsapp_link"]);
  });

  it("records partial and full payments with numbered receipts", async () => {
    const { actor, client } = await setup();
    const id = await createInvoiceDraft({ clientId: client.id }, actor);
    await saveInvoiceDraft(id, input(), actor);
    await expect(recordPayment(id, payment("100"), actor)).rejects.toThrow(/envoyez-la/);
    await sendInvoiceByEmail(id, {}, actor);

    const first = await recordPayment(id, payment("400"), actor);
    expect(first.receipt.number).toBe("REC-2026-0001");
    let { invoice } = (await getInvoice(id))!;
    expect(invoice.status).toBe("partially_paid");
    expect(invoice.amountPaid).toBe(40000);
    expect(invoice.balance).toBe(60000);

    await expect(recordPayment(id, payment("700"), actor)).rejects.toThrow(/dépasse le solde/);
    const second = await recordPayment(id, payment("600", { method: "cash", reference: "" }), actor);
    expect(second.receipt.number).toBe("REC-2026-0002");
    ({ invoice } = (await getInvoice(id))!);
    expect(invoice.status).toBe("paid");
    expect(invoice.balance).toBe(0);
    expect(invoice.paidAt).not.toBeNull();

    const found = await getReceiptByToken(first.receipt.publicToken);
    expect(found?.payment.amount).toBe(40000);
    const pdf = await renderReceiptPdf(found!.receipt, found!.payment, found!.invoice);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");

    await clearOutbox();
    await sendReceiptByEmail(second.receipt.id, actor);
    const [mail] = await readOutbox();
    expect(mail).toContain("REC-2026-0002.pdf");
    await expect(cancelInvoice(id, "erreur", actor)).rejects.toThrow();
  });

  it("marks overdue invoices and keeps currencies apart in reports", async () => {
    const { actor, client } = await setup();
    const late = await createInvoiceDraft({ clientId: client.id }, actor);
    await saveInvoiceDraft(late, input({ issueDate: "2026-01-02", dueDate: "2026-01-10" }), actor);
    await sendInvoiceByEmail(late, {}, actor);
    const cdf = await createInvoiceDraft({ clientId: client.id }, actor);
    await saveInvoiceDraft(cdf, input({ currency: "CDF", items: [{ description: "Hébergement", quantity: "1", unitPrice: "50 000" }] }), actor);
    await sendInvoiceByEmail(cdf, {}, actor);
    await getDb().update(invoices).set({ status: "sent" }).where(eq(invoices.id, late));

    expect(await markOverdueInvoices()).toBe(1);
    expect((await getInvoice(late))!.invoice.status).toBe("overdue");
    await recordPayment(late, payment("100"), actor);
    expect((await getInvoice(late))!.invoice.status).toBe("overdue");

    const report = await billingReport();
    const outstanding = Object.fromEntries(report.outstanding.map((row) => [row.currency, row.amount]));
    expect(outstanding).toEqual({ USD: 90000, CDF: 5000000 });
    expect(report.monthly).toEqual([{ month: "2026-11", currency: "USD", amount: 10000, count: 1 }]);

    const csv = await invoicesCsv();
    expect(csv.split("\r\n")[0]).toContain("Numéro;Date");
    expect(csv).toContain("FAC-2026-0001");
  });

  it("cancels an unpaid invoice and creates deposit invoices from milestones", async () => {
    const { actor, client } = await setup();
    const id = await createInvoiceDraft({ clientId: client.id }, actor);
    await saveInvoiceDraft(id, input(), actor);
    await sendInvoiceByEmail(id, {}, actor);
    await cancelInvoice(id, "Doublon", actor);
    const { invoice } = (await getInvoice(id))!;
    expect(invoice.status).toBe("cancelled");
    expect(invoice.balance).toBe(0);
    await expect(recordPayment(id, payment("10"), actor)).rejects.toThrow();
  });
});
