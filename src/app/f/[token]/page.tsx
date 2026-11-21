import { AlertTriangle, CheckCircle2, FileDown, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { QuoteDecision } from "@/components/public/quote-decision";
import { QuoteNegotiation } from "@/components/public/quote-negotiation";
import { latestRevision, negotiationThread } from "@/server/services/negotiation";
import { formatMoney } from "@/lib/money";
import { RATE_LIMITS, consumeRateLimit } from "@/server/auth/rate-limit";
import { readSettingUncached } from "@/server/content/queries";
import { acceptQuoteAction, declineQuoteAction, negotiateQuoteAction } from "@/server/actions/documents";
import { recordAppSignal } from "@/monitoring/record";
import { getRequestContext } from "@/server/request-context";
import { DocumentHeader, InvoiceView, ReceiptView, type EngagementView } from "@/components/public/document-views";
import { getMediaById } from "@/server/content/queries";
import type { Invoice } from "@/server/db/schema";
import { engagementRows, engagementSummary, getInvoiceByToken, getReceiptByToken, markInvoiceViewed } from "@/server/services/invoices";
import { getQuoteByToken, isExpired, markQuoteViewed } from "@/server/services/quotes";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const robots = { index: false, follow: false };
  const found = await getQuoteByToken(token);
  if (found) {
    const english = found.quote.locale === "en";
    return { title: `${english ? "Quote" : "Devis"} ${found.quote.number ?? ""} | Isaac Akonkwa`, robots };
  }
  const invoice = await getInvoiceByToken(token);
  if (invoice) return { title: `${invoice.invoice.locale === "en" ? "Invoice" : "Facture"} ${invoice.invoice.number ?? ""} | Isaac Akonkwa`, robots };
  const receipt = await getReceiptByToken(token);
  if (receipt) return { title: `${receipt.invoice.locale === "en" ? "Receipt" : "Reçu"} ${receipt.receipt.number} | Isaac Akonkwa`, robots };
  return { title: "Document | Isaac Akonkwa", robots };
}

const T = {
  fr: {
    quote: "Devis",
    for: "Pour",
    issued: "Émis le",
    valid: "Valable jusqu'au",
    description: "Description",
    qty: "Qté",
    unit: "Prix unitaire",
    total: "Total",
    subtotal: "Sous-total",
    discount: "Remise",
    tax: "Taxe",
    grand: "Total à payer",
    approx: "Soit environ",
    rate: "au taux indicatif de",
    notes: "Notes",
    terms: "Conditions",
    payment: "Modalités de paiement",
    pdf: "Télécharger le PDF",
    accepted: (name: string, date: string) => `Devis accepté par ${name} le ${date}.`,
    declined: "Ce devis a été refusé.",
    expired: "Ce devis a expiré. Contactez Isaac Akonkwa pour une version à jour.",
    notFound: "Ce document est introuvable ou le lien n'est plus valide.",
    negotiating: "Votre proposition a été transmise. Vous pouvez tout de même accepter ou refuser ce devis en l'état.",
    revised: "Ce devis a été remplacé par une nouvelle version.",
    seeRevision: "Voir la nouvelle version",
    thread: "Échanges sur ce devis",
    you: "Vous",
    proposed: "Budget proposé",
    features: "Fonctionnalités demandées",
    version: "version",
  },
  en: {
    quote: "Quote",
    for: "For",
    issued: "Issued on",
    valid: "Valid until",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    grand: "Total due",
    approx: "About",
    rate: "at the indicative rate of",
    notes: "Notes",
    terms: "Terms",
    payment: "Payment details",
    pdf: "Download PDF",
    accepted: (name: string, date: string) => `Quote accepted by ${name} on ${date}.`,
    declined: "This quote was declined.",
    expired: "This quote has expired. Contact Isaac Akonkwa for an updated version.",
    notFound: "This document cannot be found or the link is no longer valid.",
    negotiating: "Your proposal has been sent. You can still accept or decline this quote as it is.",
    revised: "This quote has been replaced by a new version.",
    seeRevision: "See the new version",
    thread: "Discussion about this quote",
    you: "You",
    proposed: "Proposed budget",
    features: "Requested features",
    version: "version",
  },
};

async function brandAssets() {
  const issuer = await readSettingUncached("issuer");
  const logo = issuer.logoMediaId ? await getMediaById(issuer.logoMediaId) : null;
  return { issuer, logoUrl: logo ? (logo.srcSet[0]?.url ?? logo.url) : null };
}

async function engagementFor(invoice: Invoice): Promise<EngagementView | null> {
  const summary = await engagementSummary(invoice);
  if (!summary) return null;
  return { ...engagementRows(summary, invoice.locale === "en" ? "en" : "fr"), currency: summary.currency };
}

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await getQuoteByToken(token);

  if (!found) {
    const invoice = await getInvoiceByToken(token);
    if (invoice) {
      await markInvoiceViewed(invoice.invoice);
      const { issuer, logoUrl } = await brandAssets();
      return <InvoiceView invoice={invoice.invoice} items={invoice.items} issuer={issuer} logoUrl={logoUrl} engagement={await engagementFor(invoice.invoice)} token={token} />;
    }
    const receipt = await getReceiptByToken(token);
    if (receipt) {
      const { issuer, logoUrl } = await brandAssets();
      return (
        <ReceiptView receipt={receipt.receipt} payment={receipt.payment} invoice={receipt.invoice} issuer={issuer} logoUrl={logoUrl} engagement={await engagementFor(receipt.invoice)} token={token} />
      );
    }
    // Repeated invalid tokens from one IP look like enumeration: slow them down.
    const { ip } = await getRequestContext();
    await consumeRateLimit(`document:invalid:${ip}`, RATE_LIMITS.login);
    await recordAppSignal({ ip, method: "GET", path: "/f/[jeton]", query: "", userAgent: (await getRequestContext()).userAgent }, { ruleId: "document.invalid-token", category: "invalid_token", severity: "medium", score: 10 });
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
        <p className="rounded-2xl border bg-card p-8 text-muted-foreground">{T.fr.notFound}</p>
      </main>
    );
  }

  const { quote, items } = found;
  await markQuoteViewed(quote);
  const locale = quote.locale === "en" ? "en" : "fr";
  const t = T[locale];
  const { issuer, logoUrl } = await brandAssets();
  const money = (cents: number) => formatMoney(cents, quote.currency, locale);
  const date = (value: string | Date) =>
    new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(
      typeof value === "string" ? new Date(`${value}T12:00:00Z`) : value,
    );
  const expired = isExpired(quote) || quote.status === "expired";
  const open = ["sent", "viewed", "negotiating"].includes(quote.status) && !expired;
  const [thread, revision] = await Promise.all([negotiationThread(quote), quote.status === "revised" ? latestRevision(quote.id) : Promise.resolve(null)]);
  const stamp = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
  const rate = quote.exchangeRate ? Number(quote.exchangeRate) : 0;
  const approx = rate
    ? quote.currency === "USD"
      ? formatMoney(Math.round(quote.total * rate), "CDF", locale)
      : formatMoney(Math.round(quote.total / rate), "USD", locale)
    : null;

  return (
    <main lang={locale} className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <DocumentHeader issuer={issuer} logoUrl={logoUrl} kind={t.quote} number={quote.number ?? ""} dates={[`${t.issued} ${date(quote.issueDate)}`, `${t.valid} ${date(quote.validUntil)}`]} />

      {quote.status === "accepted" && quote.acceptedAt && (
        <p role="status" className="mt-8 flex items-center gap-2 rounded-xl border border-success/40 bg-success/5 p-4 text-sm">
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          {t.accepted(quote.acceptedBy ?? "", date(quote.acceptedAt))}
        </p>
      )}
      {quote.status === "declined" && (
        <p role="status" className="mt-8 flex items-center gap-2 rounded-xl border p-4 text-sm">
          <XCircle className="size-5 text-destructive" aria-hidden="true" />
          {t.declined}
        </p>
      )}
      {quote.status === "revised" && (
        <div role="status" className="mt-8 flex flex-col gap-3 rounded-xl border border-info/40 bg-info/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>{t.revised}</span>
          {revision && (
            <a href={`/f/${revision.publicToken}`} className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 font-semibold text-accent-foreground">
              {t.seeRevision}
            </a>
          )}
        </div>
      )}
      {quote.status === "negotiating" && !expired && (
        <p role="status" className="mt-8 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
          {t.negotiating}
        </p>
      )}
      {expired && quote.status !== "accepted" && quote.status !== "declined" && quote.status !== "revised" && (
        <p role="status" className="mt-8 flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4 text-sm">
          <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
          {t.expired}
        </p>
      )}

      <section className="mt-10">
        <p className="text-sm text-muted-foreground">
          {t.for} <span className="font-medium text-foreground">{quote.recipientName}</span>
        </p>
        <h1 className="mt-2 text-(length:--text-h2) font-medium">{quote.title}</h1>
      </section>

      <div className="mt-8 overflow-hidden rounded-2xl border bg-card">
        <ul className="divide-y text-sm sm:hidden">
          {items.map((item) => (
            <li key={item.id} className="px-5 py-3">
              <p>{item.description}</p>
              <p className="mt-1 flex justify-between gap-3 text-muted-foreground">
                <span className="tabular-nums">
                  {Number(item.quantity).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} × {money(item.unitPrice)}
                </span>
                <span className="font-medium tabular-nums text-foreground">{money(item.total)}</span>
              </p>
            </li>
          ))}
        </ul>
        <table className="hidden w-full text-sm sm:table">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="px-5 py-3 font-medium">{t.description}</th>
              <th className="px-5 py-3 text-right font-medium">{t.qty}</th>
              <th className="px-5 py-3 text-right font-medium">{t.unit}</th>
              <th className="px-5 py-3 text-right font-medium">{t.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3">{item.description}</td>
                <td className="px-5 py-3 text-right tabular-nums">{Number(item.quantity).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}</td>
                <td className="px-5 py-3 text-right tabular-nums">{money(item.unitPrice)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{money(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto max-w-sm space-y-1.5 border-t p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.subtotal}</dt>
            <dd className="tabular-nums">{money(quote.subtotal)}</dd>
          </div>
          {quote.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.discount}</dt>
              <dd className="tabular-nums">- {money(quote.discount)}</dd>
            </div>
          )}
          {quote.taxAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {t.tax} ({quote.taxRate / 100} %)
              </dt>
              <dd className="tabular-nums">{money(quote.taxAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-lg font-semibold">
            <dt>{t.grand}</dt>
            <dd className="tabular-nums">{money(quote.total)}</dd>
          </div>
          {approx && (
            <p className="text-right text-xs text-muted-foreground">
              {t.approx} {approx} {t.rate} 1 USD = {rate.toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} CDF
            </p>
          )}
        </dl>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {[
          [t.notes, quote.notes],
          [t.terms, quote.terms],
          [t.payment, issuer.paymentDetails],
        ]
          .filter(([, text]) => text)
          .map(([label, text]) => (
            <section key={label}>
              <h2 className="label-mono text-muted-foreground">{label}</h2>
              <p className="mt-2 whitespace-pre-line text-sm">{text}</p>
            </section>
          ))}
      </div>

      <div className="mt-8">
        <a href={`/f/${token}/pdf`} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:bg-surface">
          <FileDown className="size-4" aria-hidden="true" />
          {t.pdf}
        </a>
      </div>

      {thread.length > 0 && (
        <section className="mt-10" aria-labelledby="thread-title">
          <h2 id="thread-title" className="label-mono text-muted-foreground">
            {t.thread}
          </h2>
          <ol className="mt-4 space-y-3">
            {thread.map((entry) => (
              <li key={entry.id} className={`rounded-2xl border p-4 text-sm ${entry.author === "client" ? "bg-surface/60 sm:mr-12" : "bg-card sm:ml-12"}`}>
                <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{entry.author === "client" ? t.you : (entry.authorName ?? issuer.name)}</span>
                  <span>
                    {entry.quoteNumber ? `${entry.quoteNumber} (${t.version} ${entry.revision}) · ` : ""}
                    {stamp.format(entry.createdAt)}
                  </span>
                </p>
                {entry.proposedTotal ? (
                  <p className="mt-2">
                    {t.proposed} : <span className="font-semibold">{money(entry.proposedTotal)}</span>
                  </p>
                ) : null}
                {entry.requestedFeatures && (
                  <p className="mt-2 whitespace-pre-line">
                    <span className="block text-muted-foreground">{t.features} :</span>
                    {entry.requestedFeatures}
                  </p>
                )}
                <p className="mt-2 whitespace-pre-line">{entry.message}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {open && (
        <div className="mt-10 space-y-6">
          <QuoteDecision locale={locale} acceptAction={acceptQuoteAction.bind(null, token)} declineAction={declineQuoteAction.bind(null, token)} />
          <QuoteNegotiation locale={locale} currency={quote.currency} defaultName={quote.recipientName} action={negotiateQuoteAction.bind(null, token)} />
        </div>
      )}
    </main>
  );
}
