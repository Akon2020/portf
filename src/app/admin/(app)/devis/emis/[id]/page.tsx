import { eq } from "drizzle-orm";
import { ExternalLink, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { QuoteEditor, QuoteSendPanel } from "@/components/admin/quote-editor";
import { ActionButton, Badge, ConfirmButton } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import {
  convertQuoteAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  saveQuoteAction,
  sendQuoteEmailAction,
  whatsappQuoteAction,
} from "@/server/actions/quotes";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { documentSends } from "@/server/db/schema";
import { getQuote, publicQuoteUrl } from "@/server/services/quotes";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "../labels";

export const metadata: Metadata = { title: "Devis" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const dateOnly = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });

/** Cents back to an editable amount ("1250,5"), empty for zero. */
function editable(cents: number): string {
  return cents ? String(cents / 100).replace(".", ",") : "";
}

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getQuote(id);
  if (!data) notFound();
  const { quote, items } = data;
  const sends = await getDb().select().from(documentSends).where(eq(documentSends.documentId, id));
  const isDraft = quote.status === "draft";
  const closed = ["accepted", "declined", "expired"].includes(quote.status);
  const money = (cents: number) => formatMoney(cents, quote.currency);

  const header = (
    <PageHeader
      title={quote.number ? `${quote.number} : ${quote.title}` : `Brouillon : ${quote.title}`}
      back={{ href: "/admin/devis/emis", label: "Devis émis" }}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge tone={QUOTE_STATUS_TONES[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
          <span>
            {quote.recipientName} · {money(quote.total)}
          </span>
          {quote.quoteRequestId && (
            <Link href={`/admin/devis/${quote.quoteRequestId}`} className="underline underline-offset-4">
              Demande d&apos;origine
            </Link>
          )}
        </span>
      }
      actions={
        <>
          <a href={`/admin/devis/emis/${id}/pdf`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-surface">
            <FileDown className="size-4" aria-hidden="true" />
            PDF
          </a>
          {!isDraft && (
            <a href={publicQuoteUrl(quote.publicToken)} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-surface">
              <ExternalLink className="size-4" aria-hidden="true" />
              Page client
            </a>
          )}
          <ConfirmButton action={duplicateQuoteAction.bind(null, id)} confirmText="Créer un nouveau brouillon à partir de ce devis ?" label="Dupliquer" variant="neutral" />
          {isDraft && <ConfirmButton action={deleteQuoteAction.bind(null, id)} confirmText="Supprimer ce brouillon ?" label="Supprimer" />}
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
            action={saveQuoteAction.bind(null, id)}
            initial={{
              title: quote.title,
              recipientName: quote.recipientName,
              recipientEmail: quote.recipientEmail ?? "",
              recipientPhone: quote.recipientPhone ?? "",
              locale: quote.locale === "en" ? "en" : "fr",
              currency: quote.currency,
              issueDate: quote.issueDate,
              validUntil: quote.validUntil,
              exchangeRate: quote.exchangeRate ? String(Number(quote.exchangeRate)).replace(".", ",") : "",
              discount: editable(quote.discount),
              taxRate: quote.taxRate ? String(quote.taxRate / 100).replace(".", ",") : "",
              notes: quote.notes ?? "",
              terms: quote.terms ?? "",
              items: items.length
                ? items.map((item) => ({ description: item.description, quantity: String(Number(item.quantity)).replace(".", ","), unitPrice: editable(item.unitPrice) }))
                : [{ description: "", quantity: "1", unitPrice: "" }],
            }}
          />
          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <QuoteSendPanel
              emailAction={sendQuoteEmailAction.bind(null, id)}
              whatsappAction={whatsappQuoteAction.bind(null, id)}
              hasEmail={!!quote.recipientEmail}
              hasPhone={!!quote.recipientPhone}
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
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="admin-card overflow-x-auto p-2">
            <table className="admin-table min-w-[520px]">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Qté</th>
                  <th className="px-4 py-3 text-right font-medium">Prix unitaire</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">{item.description}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{Number(item.quantity).toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(item.unitPrice)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">Sous-total</td>
                  <td className="px-4 py-2 text-right tabular-nums">{money(quote.subtotal)}</td>
                </tr>
                {quote.discount > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-1 text-right text-muted-foreground">Remise</td>
                    <td className="px-4 py-1 text-right tabular-nums">- {money(quote.discount)}</td>
                  </tr>
                )}
                {quote.taxAmount > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-1 text-right text-muted-foreground">Taxe ({quote.taxRate / 100} %)</td>
                    <td className="px-4 py-1 text-right tabular-nums">{money(quote.taxAmount)}</td>
                  </tr>
                )}
                <tr className="font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(quote.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>
          <p className="text-sm text-muted-foreground">
            Un devis envoyé n&apos;est plus modifiable. Pour le réviser, utilisez « Dupliquer » : un nouveau brouillon est créé et recevra son propre numéro.
          </p>
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 admin-card p-5">
            <h2 className="font-sans text-base font-semibold tracking-normal">Suivi</h2>
            <ul className="space-y-1.5 text-sm">
              <li>Émis le {dateOnly.format(new Date(`${quote.issueDate}T12:00:00Z`))}</li>
              <li>Valable jusqu&apos;au {dateOnly.format(new Date(`${quote.validUntil}T12:00:00Z`))}</li>
              {quote.sentAt && <li>Envoyé le {dateTime.format(quote.sentAt)}</li>}
              {quote.viewedAt && <li>Consulté le {dateTime.format(quote.viewedAt)}</li>}
              {quote.acceptedAt && (
                <li className="text-success">
                  Accepté le {dateTime.format(quote.acceptedAt)} par {quote.acceptedBy} (IP {quote.acceptedIp})
                </li>
              )}
              {quote.declinedAt && <li className="text-destructive">Refusé le {dateTime.format(quote.declinedAt)}</li>}
            </ul>
            {sends.length > 0 && (
              <ul className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                {sends.map((send) => (
                  <li key={send.id}>
                    {send.channel === "email" ? "E-mail" : "WhatsApp"} à {send.recipient}, {dateTime.format(send.sentAt)}
                    {send.openedAt ? ", ouvert" : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {quote.status === "accepted" && (
            <section className="space-y-3 rounded-xl border border-success/40 bg-success/5 p-5">
              <h2 className="font-sans text-base font-semibold tracking-normal">Conversion</h2>
              {quote.convertedAt ? (
                <p className="text-sm">Client créé ou rattaché le {dateTime.format(quote.convertedAt)}.</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Crée ou rattache la fiche client. Le projet client, les jalons et la facture d&apos;acompte arriveront avec le module de facturation.
                  </p>
                  <ActionButton action={convertQuoteAction.bind(null, id)} label="Convertir en client" />
                </>
              )}
            </section>
          )}
          {!closed && (
            <QuoteSendPanel
              emailAction={sendQuoteEmailAction.bind(null, id)}
              whatsappAction={whatsappQuoteAction.bind(null, id)}
              hasEmail={!!quote.recipientEmail}
              hasPhone={!!quote.recipientPhone}
              alreadySent
            />
          )}
        </aside>
      </div>
    </>
  );
}
