import { AlertTriangle, CheckCircle2, FileDown, XCircle } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/money";
import type { IssuerSettings } from "@/server/content/settings-schema";
import type { Invoice, InvoiceItem, Payment, Receipt } from "@/server/db/schema";
import { PAYMENT_METHOD_LABELS } from "@/server/services/invoices";

type Locale = "fr" | "en";

const T = {
  fr: {
    invoice: "Facture",
    deposit: "Facture d'acompte",
    receipt: "Reçu",
    for: "Pour",
    issued: "Émise le",
    due: "À régler avant le",
    paidOn: "Payé le",
    description: "Description",
    qty: "Qté",
    unit: "Prix unitaire",
    total: "Total",
    subtotal: "Sous-total",
    discount: "Remise",
    tax: "Taxe",
    paid: "Déjà payé",
    balance: "Solde à payer",
    notes: "Notes",
    terms: "Conditions",
    payment: "Modalités de paiement",
    pdf: "Télécharger le PDF",
    statusPaid: "Cette facture est entièrement réglée. Merci !",
    statusPartial: (amount: string) => `Paiement partiel reçu. Reste à régler : ${amount}.`,
    statusOverdue: (date: string) => `L'échéance du ${date} est dépassée. Merci de régulariser dès que possible.`,
    statusCancelled: "Cette facture a été annulée.",
    received: (amount: string, method: string) => `Paiement de ${amount} reçu par ${method}.`,
    reference: "Référence",
    invoiceRef: "Facture",
    remaining: "Solde restant sur la facture",
    settled: "La facture est entièrement réglée.",
  },
  en: {
    invoice: "Invoice",
    deposit: "Deposit invoice",
    receipt: "Receipt",
    for: "For",
    issued: "Issued on",
    due: "Due by",
    paidOn: "Paid on",
    description: "Description",
    qty: "Qty",
    unit: "Unit price",
    total: "Total",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    paid: "Paid",
    balance: "Balance due",
    notes: "Notes",
    terms: "Terms",
    payment: "Payment details",
    pdf: "Download PDF",
    statusPaid: "This invoice is fully paid. Thank you!",
    statusPartial: (amount: string) => `Partial payment received. Remaining: ${amount}.`,
    statusOverdue: (date: string) => `The due date of ${date} has passed. Please settle as soon as possible.`,
    statusCancelled: "This invoice was cancelled.",
    received: (amount: string, method: string) => `Payment of ${amount} received by ${method}.`,
    reference: "Reference",
    invoiceRef: "Invoice",
    remaining: "Remaining balance on the invoice",
    settled: "The invoice is fully paid.",
  },
};

const formatDay = (value: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

function IssuerHeader({ issuer, kind, number, dates }: { issuer: IssuerSettings; kind: string; number: string; dates: string[] }) {
  return (
    <header className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
      <div>
        <p className="font-heading text-2xl">{issuer.businessName || issuer.name}</p>
        {issuer.businessName && <p className="text-sm">{issuer.name}</p>}
        {issuer.address && <p className="text-sm text-muted-foreground">{issuer.address}</p>}
        {issuer.email && <p className="text-sm text-muted-foreground">{issuer.email}</p>}
      </div>
      <div className="sm:text-right">
        <p className="label-mono text-accent">{kind}</p>
        <p className="font-mono text-lg">{number}</p>
        {dates.map((line) => (
          <p key={line} className="text-sm text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
    </header>
  );
}

function Banner({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: React.ReactNode }) {
  const styles = {
    success: ["border-success/40 bg-success/5", <CheckCircle2 key="i" className="size-5 shrink-0 text-success" aria-hidden="true" />],
    warning: ["border-warning/40 bg-warning/5", <AlertTriangle key="i" className="size-5 shrink-0 text-warning" aria-hidden="true" />],
    danger: ["border-destructive/40 bg-destructive/5", <AlertTriangle key="i" className="size-5 shrink-0 text-destructive" aria-hidden="true" />],
    neutral: ["", <XCircle key="i" className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />],
  } as const;
  const [classes, icon] = styles[tone];
  return (
    <p role="status" className={`mt-8 flex items-center gap-2 rounded-xl border p-4 text-sm ${classes}`}>
      {icon}
      {children}
    </p>
  );
}

function PdfLink({ token, label }: { token: string; label: string }) {
  return (
    <a href={`/f/${token}/pdf`} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:bg-surface">
      <FileDown className="size-4" aria-hidden="true" />
      {label}
    </a>
  );
}

export function InvoiceView({ invoice, items, issuer, token }: { invoice: Invoice; items: InvoiceItem[]; issuer: IssuerSettings; token: string }) {
  const locale: Locale = invoice.locale === "en" ? "en" : "fr";
  const t = T[locale];
  const money = (cents: number) => formatMoney(cents, invoice.currency, locale);
  const numberFormat = locale === "fr" ? "fr-FR" : "en-US";

  return (
    <main lang={locale} className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <IssuerHeader
        issuer={issuer}
        kind={invoice.kind === "deposit" ? t.deposit : t.invoice}
        number={invoice.number ?? ""}
        dates={[`${t.issued} ${formatDay(invoice.issueDate, locale)}`, `${t.due} ${formatDay(invoice.dueDate, locale)}`]}
      />

      {invoice.status === "paid" && <Banner tone="success">{t.statusPaid}</Banner>}
      {invoice.status === "partially_paid" && <Banner tone="warning">{t.statusPartial(money(invoice.balance))}</Banner>}
      {invoice.status === "overdue" && <Banner tone="danger">{t.statusOverdue(formatDay(invoice.dueDate, locale))}</Banner>}
      {invoice.status === "cancelled" && <Banner tone="neutral">{t.statusCancelled}</Banner>}

      <section className="mt-10">
        <p className="text-sm text-muted-foreground">
          {t.for} <span className="font-medium text-foreground">{invoice.recipientName}</span>
        </p>
        <h1 className="mt-2 text-(length:--text-h2) font-medium">{invoice.title}</h1>
      </section>

      <div className="mt-8 overflow-hidden rounded-2xl border bg-card">
        <ul className="divide-y text-sm sm:hidden">
          {items.map((item) => (
            <li key={item.id} className="px-5 py-3">
              <p>{item.description}</p>
              <p className="mt-1 flex justify-between gap-3 text-muted-foreground">
                <span className="tabular-nums">
                  {Number(item.quantity).toLocaleString(numberFormat)} × {money(item.unitPrice)}
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
                <td className="px-5 py-3 text-right tabular-nums">{Number(item.quantity).toLocaleString(numberFormat)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{money(item.unitPrice)}</td>
                <td className="px-5 py-3 text-right tabular-nums">{money(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto max-w-sm space-y-1.5 border-t p-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.subtotal}</dt>
            <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t.discount}</dt>
              <dd className="tabular-nums">- {money(invoice.discount)}</dd>
            </div>
          )}
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {t.tax} ({invoice.taxRate / 100} %)
              </dt>
              <dd className="tabular-nums">{money(invoice.taxAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 font-semibold">
            <dt>{t.total}</dt>
            <dd className="tabular-nums">{money(invoice.total)}</dd>
          </div>
          {invoice.amountPaid > 0 && (
            <div className="flex justify-between text-success">
              <dt>{t.paid}</dt>
              <dd className="tabular-nums">- {money(invoice.amountPaid)}</dd>
            </div>
          )}
          {invoice.status !== "cancelled" && (
            <div className="flex justify-between border-t pt-2 text-lg font-semibold">
              <dt>{t.balance}</dt>
              <dd className="tabular-nums">{money(invoice.balance)}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {[
          [t.notes, invoice.notes],
          [t.terms, invoice.terms],
          [t.payment, invoice.status === "paid" || invoice.status === "cancelled" ? null : issuer.paymentDetails],
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
        <PdfLink token={token} label={t.pdf} />
      </div>
    </main>
  );
}

export function ReceiptView({ receipt, payment, invoice, issuer, token }: { receipt: Receipt; payment: Payment; invoice: Invoice; issuer: IssuerSettings; token: string }) {
  const locale: Locale = invoice.locale === "en" ? "en" : "fr";
  const t = T[locale];
  const money = (cents: number, currency: Currency = payment.currency) => formatMoney(cents, currency, locale);
  return (
    <main lang={locale} className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <IssuerHeader issuer={issuer} kind={t.receipt} number={receipt.number} dates={[`${t.paidOn} ${formatDay(payment.paidAt, locale)}`]} />
      <Banner tone="success">{t.received(money(payment.amount), PAYMENT_METHOD_LABELS[payment.method][locale])}</Banner>
      <section className="mt-10 rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {t.for} <span className="font-medium text-foreground">{invoice.recipientName}</span>
        </p>
        <h1 className="mt-2 text-(length:--text-h3) font-medium">{invoice.title}</h1>
        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="label-mono text-muted-foreground">{t.invoiceRef}</dt>
            <dd className="mt-1 font-mono">{invoice.number}</dd>
          </div>
          {payment.reference && (
            <div>
              <dt className="label-mono text-muted-foreground">{t.reference}</dt>
              <dd className="mt-1 font-mono">{payment.reference}</dd>
            </div>
          )}
          <div>
            <dt className="label-mono text-muted-foreground">{t.total}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{money(payment.amount)}</dd>
          </div>
          <div>
            <dt className="label-mono text-muted-foreground">{t.remaining}</dt>
            <dd className="mt-1 tabular-nums">{invoice.balance > 0 ? money(invoice.balance, invoice.currency) : t.settled}</dd>
          </div>
        </dl>
        {payment.note && <p className="mt-6 whitespace-pre-line text-sm text-muted-foreground">{payment.note}</p>}
      </section>
      <div className="mt-8">
        <PdfLink token={token} label={t.pdf} />
      </div>
    </main>
  );
}
