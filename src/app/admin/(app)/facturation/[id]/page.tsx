import { eq, inArray, or } from "drizzle-orm";
import { ExternalLink, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelInvoiceForm, PaymentForm, ResultButton, WhatsappButton } from "@/components/admin/crm-forms";
import { PageHeader } from "@/components/admin/page-header";
import { QuoteEditor, QuoteSendPanel } from "@/components/admin/quote-editor";
import { Badge, ConfirmButton } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import {
  cancelInvoiceAction,
  deleteInvoiceAction,
  recordPaymentAction,
  saveInvoiceAction,
  sendInvoiceEmailAction,
  sendReceiptEmailAction,
  whatsappInvoiceAction,
  whatsappReceiptAction,
  createBalanceInvoiceAction,
} from "@/server/actions/crm";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { documentSends } from "@/server/db/schema";
import { OPEN_STATUSES, PAYMENT_METHOD_LABELS, engagementSummary, getInvoice, publicDocumentUrl } from "@/server/services/invoices";
import { today } from "@/server/services/quotes";
import { INVOICE_STATUS } from "../../clients/labels";

export const metadata: Metadata = { title: "Facture" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const editable = (cents: number) => (cents ? String(cents / 100).replace(".", ",") : "");

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getInvoice(id);
  if (!data) notFound();
  const { invoice, items } = data;
  const receiptIds = data.payments.map((row) => row.receipt?.id).filter((value): value is string => Boolean(value));
  const sends = await getDb()
    .select()
    .from(documentSends)
    .where(receiptIds.length ? or(eq(documentSends.documentId, id), inArray(documentSends.documentId, receiptIds)) : eq(documentSends.documentId, id));
  const isDraft = invoice.status === "draft";
  const engagement = await engagementSummary(invoice);
  const open = OPEN_STATUSES.includes(invoice.status);
  const money = (cents: number) => formatMoney(cents, invoice.currency);
  const [statusLabel, statusTone] = INVOICE_STATUS[invoice.status];

  const header = (
    <PageHeader
      title={invoice.number ? `${invoice.number} : ${invoice.title}` : `Brouillon : ${invoice.title}`}
      back={{ href: "/admin/facturation", label: "Facturation" }}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          {invoice.kind === "deposit" && <Badge tone="info">Acompte</Badge>}
          <Link href={`/admin/clients/${invoice.clientId}`} className="underline underline-offset-4">
            {invoice.recipientName}
          </Link>
          <span>{money(invoice.total)}</span>
          {invoice.clientProjectId && (
            <Link href={`/admin/clients/projets/${invoice.clientProjectId}`} className="underline underline-offset-4">
              Projet
            </Link>
          )}
        </span>
      }
      actions={
        <>
          <a href={`/admin/facturation/${id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm hover:bg-surface">
            <FileDown className="size-4" aria-hidden="true" /> PDF
          </a>
          {!isDraft && (
            <a href={publicDocumentUrl(invoice.publicToken)} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm hover:bg-surface">
              <ExternalLink className="size-4" aria-hidden="true" /> Page client
            </a>
          )}
          {isDraft && !invoice.number && <ConfirmButton action={deleteInvoiceAction.bind(null, id)} confirmText="Supprimer ce brouillon ?" label="Supprimer" />}
        </>
      }
    />
  );

  if (isDraft) {
    return (
      <>
        {header}
        <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_320px]">
          <QuoteEditor
            kind="invoice"
            action={saveInvoiceAction.bind(null, id)}
            initial={{
              title: invoice.title,
              recipientName: invoice.recipientName,
              recipientEmail: invoice.recipientEmail ?? "",
              recipientPhone: invoice.recipientPhone ?? "",
              recipientAddress: invoice.recipientAddress ?? "",
              locale: invoice.locale === "en" ? "en" : "fr",
              currency: invoice.currency,
              issueDate: invoice.issueDate,
              validUntil: invoice.dueDate,
              exchangeRate: invoice.exchangeRate ? String(Number(invoice.exchangeRate)).replace(".", ",") : "",
              discount: editable(invoice.discount),
              taxRate: invoice.taxRate ? String(invoice.taxRate / 100).replace(".", ",") : "",
              notes: invoice.notes ?? "",
              terms: invoice.terms ?? "",
              items: items.length
                ? items.map((item) => ({ description: item.description, quantity: String(Number(item.quantity)).replace(".", ","), unitPrice: editable(item.unitPrice) }))
                : [{ description: "", quantity: "1", unitPrice: "" }],
            }}
          />
          <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <QuoteSendPanel
              kind="invoice"
              emailAction={sendInvoiceEmailAction.bind(null, id)}
              whatsappAction={whatsappInvoiceAction.bind(null, id, false)}
              hasEmail={!!invoice.recipientEmail}
              hasPhone={!!invoice.recipientPhone}
              alreadySent={false}
            />
            <p className="text-xs text-muted-foreground">Enregistrez le brouillon avant l&apos;envoi : c&apos;est la version enregistrée qui est envoyée.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            {[
              ["Total", money(invoice.total), ""],
              ["Payé", money(invoice.amountPaid), "text-success"],
              ["Solde", invoice.status === "cancelled" ? "Annulée" : money(invoice.balance), invoice.status === "overdue" ? "text-destructive" : ""],
            ].map(([label, value, tone]) => (
              <div key={label} className="admin-card p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
              </div>
            ))}
          </section>

          <section className="admin-card overflow-x-auto p-2">
            <table className="admin-table min-w-[520px]">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="text-right">Qté</th>
                  <th className="text-right">Prix unitaire</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td className="text-right tabular-nums">{Number(item.quantity).toLocaleString("fr-FR")}</td>
                    <td className="text-right tabular-nums">{money(item.unitPrice)}</td>
                    <td className="text-right tabular-nums">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Émise le {day(invoice.issueDate)}, échéance le {day(invoice.dueDate)}.
              {invoice.cancelReason && ` Annulée : ${invoice.cancelReason}.`}
            </p>
          </section>

          <section className="admin-card p-5">
            <h2 className="text-base font-semibold">Paiements et reçus</h2>
            {data.payments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Aucun paiement enregistré.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {data.payments.map(({ payment, receipt }) => (
                  <li key={payment.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium tabular-nums">{formatMoney(payment.amount, payment.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {[day(payment.paidAt), PAYMENT_METHOD_LABELS[payment.method].fr, payment.reference && `réf. ${payment.reference}`].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {receipt && (
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`/admin/facturation/recus/${receipt.id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 font-mono text-xs hover:bg-surface">
                          <FileDown className="size-3.5" aria-hidden="true" /> {receipt.number}
                        </a>
                        <ResultButton action={sendReceiptEmailAction.bind(null, id, receipt.id)} label="E-mail" />
                        <WhatsappButton action={whatsappReceiptAction.bind(null, receipt.id)} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {sends.length > 0 && (
            <section className="admin-card p-5">
              <h2 className="text-base font-semibold">Historique des envois</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {sends.map((send) => (
                  <li key={send.id}>
                    {send.documentType === "receipt" ? "Reçu" : "Facture"} par {send.channel === "email" ? "e-mail" : "WhatsApp"} à {send.recipient}, {dateTime.format(send.sentAt)}
                    {send.openedAt ? ", consulté" : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {open && (
            <section className="admin-card p-5">
              <h2 className="mb-4 text-base font-semibold">Enregistrer un paiement</h2>
              <PaymentForm action={recordPaymentAction.bind(null, id)} balance={invoice.balance} currency={invoice.currency} today={today()} hasEmail={!!invoice.recipientEmail} />
            </section>
          )}
          {open && (
            <QuoteSendPanel
              kind="invoice"
              mode={invoice.status === "overdue" || invoice.amountPaid > 0 ? "reminder" : "send"}
              emailAction={sendInvoiceEmailAction.bind(null, id)}
              whatsappAction={whatsappInvoiceAction.bind(null, id, invoice.status === "overdue" || invoice.amountPaid > 0)}
              hasEmail={!!invoice.recipientEmail}
              hasPhone={!!invoice.recipientPhone}
              alreadySent
            />
          )}
          {open && invoice.amountPaid === 0 && (
            <section className="admin-card p-5">
              <h2 className="mb-3 text-base font-semibold">Annulation</h2>
              <p className="mb-3 text-sm text-muted-foreground">Une facture envoyée n&apos;est jamais modifiée : annulez-la puis créez-en une nouvelle.</p>
              <CancelInvoiceForm action={cancelInvoiceAction.bind(null, id)} />
            </section>
          )}
          {engagement && (
            <section className="admin-card p-5">
              <h2 className="text-base font-semibold">Suivi des paiements</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{engagement.kind === "quote" ? "Devis" : "Projet"} {engagement.label}</p>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Part réglée" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((engagement.paid / Math.max(1, engagement.total)) * 100)}>
                <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, (engagement.paid / Math.max(1, engagement.total)) * 100)}%` }} />
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Montant total</dt>
                  <dd className="tabular-nums">{formatMoney(engagement.total, engagement.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Facturé</dt>
                  <dd className="tabular-nums">{formatMoney(engagement.invoiced, engagement.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Réglé (tous paiements)</dt>
                  <dd className="tabular-nums text-success">{formatMoney(engagement.paid, engagement.currency)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-2 font-semibold">
                  <dt>Reste à payer</dt>
                  <dd className="tabular-nums">{formatMoney(engagement.remaining, engagement.currency)}</dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-1.5 border-t pt-3 text-xs">
                {engagement.invoices.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/facturation/${row.id}`} className={`font-mono hover:text-accent ${row.id === invoice.id ? "font-semibold" : ""}`}>
                      {row.number ?? "Brouillon"}
                      {row.kind === "deposit" ? " (acompte)" : ""}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">{row.status === "cancelled" ? "annulée" : `${formatMoney(row.amountPaid, engagement.currency)} / ${formatMoney(row.total, engagement.currency)}`}</span>
                  </li>
                ))}
              </ul>
              {engagement.toInvoice > 0 ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Reste à facturer : {formatMoney(engagement.toInvoice, engagement.currency)}</p>
                  <ResultButton action={createBalanceInvoiceAction.bind(null, invoice.id)} label="Facturer le solde" confirmText="Créer une facture brouillon pour le solde restant ?" />
                </div>
              ) : engagement.remaining === 0 ? (
                <p className="mt-4 text-sm font-medium text-success">Montant total entièrement réglé.</p>
              ) : null}
            </section>
          )}
          {invoice.lastReminderAt && <p className="text-xs text-muted-foreground">Dernière relance le {dateTime.format(invoice.lastReminderAt)}.</p>}
        </div>
      </div>
    </>
  );
}
