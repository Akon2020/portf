import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/money";
import { readSettingUncached } from "@/server/content/settings-store";
import type { Invoice, InvoiceItem, Payment, Quote, QuoteItem, Receipt } from "@/server/db/schema";
import { PAYMENT_METHOD_LABELS, engagementRows, engagementSummary, formatDocDate, publicDocumentUrl } from "@/server/services/invoices";
import { BusinessDocument, type BusinessDocumentData } from "./business-document";
import { loadLogo } from "./logo";

async function render(data: BusinessDocumentData): Promise<Buffer> {
  const issuer = await readSettingUncached("issuer");
  const logo = await loadLogo(issuer.logoMediaId);
  const element = createElement(BusinessDocument, { data, issuer, logo }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

const qr = (token: string) => QRCode.toDataURL(publicDocumentUrl(token), { margin: 0, width: 220 });
const localeOf = (value: string) => (value === "en" ? "en" : "fr") as "fr" | "en";

/** Quote PDF. Drafts have no public link, so no QR code. */
export async function renderQuotePdf(quote: Quote, items: QuoteItem[]): Promise<Buffer> {
  const locale = localeOf(quote.locale);
  const fr = locale === "fr";
  const issuer = await readSettingUncached("issuer");
  return render({
    locale,
    heading: fr ? "DEVIS" : "QUOTE",
    number: quote.number,
    dates: [
      [fr ? "Date d'émission" : "Issue date", formatDocDate(quote.issueDate, locale)],
      [fr ? "Valable jusqu'au" : "Valid until", formatDocDate(quote.validUntil, locale)],
    ],
    recipient: { name: quote.recipientName, lines: [quote.recipientEmail ?? "", quote.recipientPhone ?? ""] },
    subject: quote.title,
    currency: quote.currency,
    items,
    totals: quote,
    grandLabel: fr ? "Total à payer" : "Total due",
    extraRows: [],
    exchangeRate: quote.exchangeRate,
    approxBase: quote.total,
    stamp:
      quote.acceptedAt && quote.acceptedBy
        ? {
            text: fr
              ? `Accepté en ligne par ${quote.acceptedBy} le ${formatDocDate(quote.acceptedAt.toISOString().slice(0, 10), locale)}`
              : `Accepted online by ${quote.acceptedBy} on ${formatDocDate(quote.acceptedAt.toISOString().slice(0, 10), locale)}`,
            tone: "success",
          }
        : null,
    sections: [
      [fr ? "Notes" : "Notes", quote.notes],
      [fr ? "Conditions" : "Terms", quote.terms],
      [fr ? "Modalités de paiement" : "Payment details", issuer.paymentDetails],
    ],
    qr: quote.status === "draft" ? null : { dataUrl: await qr(quote.publicToken), label: fr ? "Consulter et accepter ce devis en ligne" : "View and accept this quote online" },
  });
}

export async function renderInvoicePdf(invoice: Invoice, items: InvoiceItem[]): Promise<Buffer> {
  const locale = localeOf(invoice.locale);
  const fr = locale === "fr";
  const issuer = await readSettingUncached("issuer");
  const summary = invoice.status === "draft" ? null : await engagementSummary(invoice);
  const stamp =
    invoice.status === "paid"
      ? { text: fr ? "PAYÉE" : "PAID", tone: "success" as const }
      : invoice.status === "cancelled"
        ? { text: fr ? `ANNULÉE${invoice.cancelReason ? ` : ${invoice.cancelReason}` : ""}` : `CANCELLED${invoice.cancelReason ? `: ${invoice.cancelReason}` : ""}`, tone: "danger" as const }
        : null;
  return render({
    locale,
    heading: fr ? (invoice.kind === "deposit" ? "FACTURE D'ACOMPTE" : "FACTURE") : invoice.kind === "deposit" ? "DEPOSIT INVOICE" : "INVOICE",
    number: invoice.number,
    dates: [
      [fr ? "Date d'émission" : "Issue date", formatDocDate(invoice.issueDate, locale)],
      [fr ? "Échéance" : "Due date", formatDocDate(invoice.dueDate, locale)],
    ],
    recipient: { name: invoice.recipientName, lines: [invoice.recipientAddress ?? "", invoice.recipientEmail ?? "", invoice.recipientPhone ?? ""] },
    subject: invoice.title,
    currency: invoice.currency,
    items,
    totals: invoice,
    grandLabel: "Total",
    extraRows:
      invoice.amountPaid > 0
        ? [
            { label: fr ? "Déjà payé" : "Paid", amount: invoice.amountPaid },
            { label: fr ? "Solde à payer" : "Balance due", amount: invoice.balance, strong: true },
          ]
        : [],
    exchangeRate: invoice.exchangeRate,
    approxBase: invoice.amountPaid > 0 ? invoice.balance : invoice.total,
    stamp,
    engagement: summary ? engagementRows(summary, locale) : null,
    sections: [
      [fr ? "Notes" : "Notes", invoice.notes],
      [fr ? "Conditions" : "Terms", invoice.terms],
      [fr ? "Modalités de paiement" : "Payment details", issuer.paymentDetails],
    ],
    qr: invoice.status === "draft" ? null : { dataUrl: await qr(invoice.publicToken), label: fr ? "Consulter et télécharger cette facture en ligne" : "View and download this invoice online" },
  });
}

export async function renderReceiptPdf(receipt: Receipt, payment: Payment, invoice: Invoice): Promise<Buffer> {
  const locale = localeOf(invoice.locale);
  const fr = locale === "fr";
  const method = PAYMENT_METHOD_LABELS[payment.method][locale];
  const amount = formatMoney(payment.amount, payment.currency, locale);
  const summary = await engagementSummary(invoice);
  return render({
    locale,
    heading: fr ? "REÇU" : "RECEIPT",
    number: receipt.number,
    dates: [
      [fr ? "Date du paiement" : "Payment date", formatDocDate(payment.paidAt, locale)],
      [fr ? "Facture" : "Invoice", invoice.number ?? ""],
    ],
    recipient: { name: invoice.recipientName, lines: [invoice.recipientAddress ?? "", invoice.recipientEmail ?? ""] },
    subject: invoice.title,
    currency: payment.currency,
    items: [
      {
        id: payment.id,
        description: fr
          ? `Paiement reçu par ${method}${payment.reference ? ` (réf. ${payment.reference})` : ""}`
          : `Payment received by ${method}${payment.reference ? ` (ref. ${payment.reference})` : ""}`,
        quantity: "1",
        unitPrice: payment.amount,
        total: payment.amount,
      },
    ],
    totals: null,
    grandLabel: "",
    extraRows: [
      { label: fr ? "Montant reçu" : "Amount received", amount: payment.amount, strong: true },
      { label: fr ? `Total de la facture ${invoice.number ?? ""}`.trim() : `Invoice total ${invoice.number ?? ""}`.trim(), amount: invoice.total },
      { label: fr ? "Solde restant" : "Remaining balance", amount: invoice.balance },
    ],
    exchangeRate: null,
    approxBase: payment.amount,
    stamp: { text: fr ? `Reçu de ${amount}, merci.` : `Received ${amount}, thank you.`, tone: "success" },
    engagement: summary ? engagementRows(summary, locale) : null,
    sections: [[fr ? "Note" : "Note", payment.note]],
    qr: { dataUrl: await qr(receipt.publicToken), label: fr ? "Vérifier ce reçu en ligne" : "Verify this receipt online" },
  });
}

/** Sample invoice with the current issuer settings, to preview the color and the logo. */
export async function renderSamplePdf(): Promise<Buffer> {
  const today = new Date().toISOString().slice(0, 10);
  return render({
    locale: "fr",
    heading: "FACTURE",
    number: "APERCU",
    dates: [
      ["Date d'émission", formatDocDate(today, "fr")],
      ["Échéance", formatDocDate(today, "fr")],
    ],
    recipient: { name: "Client exemple", lines: ["Aperçu du modèle, aucune facture réelle"] },
    subject: "Aperçu de la mise en page",
    currency: "USD",
    items: [
      { id: "a", description: "Ligne d'exemple", quantity: "1", unitPrice: 100000, total: 100000 },
      { id: "b", description: "Deuxième ligne d'exemple", quantity: "2", unitPrice: 25000, total: 50000 },
    ],
    totals: { subtotal: 150000, discount: 0, taxRate: 0, taxAmount: 0, total: 150000 },
    grandLabel: "Total",
    extraRows: [
      { label: "Déjà payé", amount: 50000 },
      { label: "Solde à payer", amount: 100000, strong: true },
    ],
    exchangeRate: null,
    approxBase: 100000,
    stamp: null,
    engagement: {
      title: "Suivi des paiements : exemple",
      rows: [
        { label: "Montant total du devis", amount: 300000 },
        { label: "Total réglé à ce jour (tous paiements)", amount: 50000 },
        { label: "Reste à payer", amount: 250000, strong: true },
      ],
    },
    sections: [["Modalités de paiement", (await readSettingUncached("issuer")).paymentDetails || "Vos modalités de paiement apparaîtront ici."]],
    qr: null,
  });
}
