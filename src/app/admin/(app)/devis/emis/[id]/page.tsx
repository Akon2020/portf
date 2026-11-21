import { eq } from "drizzle-orm";
import { ExternalLink, FileDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { NegotiationReply, QuoteEditor, QuoteSendPanel } from "@/components/admin/quote-editor";
import { Badge, ConfirmButton } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import {
  convertQuoteAction,
  deleteQuoteAction,
  duplicateQuoteAction,
  replyNegotiationAction,
  reviseQuoteAction,
  saveQuoteAction,
  sendQuoteEmailAction,
  whatsappQuoteAction,
} from "@/server/actions/quotes";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { documentSends } from "@/server/db/schema";
import { getQuote, publicQuoteUrl } from "@/server/services/quotes";
import { OPEN_QUOTE_STATUSES, latestRevision, negotiationThread } from "@/server/services/negotiation";
import { quotes } from "@/server/db/schema";
import { and, isNull } from "drizzle-orm";
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
  const closed = ["accepted", "declined", "expired", "revised"].includes(quote.status);
  const [thread, revision, [parent], drafts] = await Promise.all([
    negotiationThread(quote),
    quote.status === "revised" ? latestRevision(quote.id) : Promise.resolve(null),
    quote.parentQuoteId ? getDb().select({ id: quotes.id, number: quotes.number }).from(quotes).where(eq(quotes.id, quote.parentQuoteId)).limit(1) : Promise.resolve([]),
    getDb().select({ id: quotes.id }).from(quotes).where(and(eq(quotes.parentQuoteId, quote.id), eq(quotes.status, "draft"), isNull(quotes.deletedAt))).limit(1),
  ]);
  const stamp = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
  const negotiation = (
    <>
      {(parent || revision) && (
        <p className="admin-card p-4 text-sm">
          {parent && (
            <>
              Révision {quote.revision} du devis{" "}
              <Link href={`/admin/devis/emis/${parent.id}`} className="font-mono text-accent hover:underline">
                {parent.number}
              </Link>
              .{" "}
            </>
          )}
          {revision && (
            <>
              Remplacé par{" "}
              <Link href={`/admin/devis/emis/${revision.id}`} className="font-mono text-accent hover:underline">
                {revision.number}
              </Link>
              .
            </>
          )}
        </p>
      )}
      {(thread.length > 0 || OPEN_QUOTE_STATUSES.includes(quote.status)) && !isDraft && (
        <section className={`space-y-4 admin-card p-5 ${quote.status === "negotiating" ? "border-warning/50" : ""}`}>
          <h2 className="text-base font-semibold">Négociation</h2>
          {thread.length === 0 ? (
            <p className="text-sm text-muted-foreground">Le client peut proposer un autre budget ou d&apos;autres fonctionnalités depuis sa page.</p>
          ) : (
            <ol className="space-y-3">
              {thread.map((entry) => (
                <li key={entry.id} className={`rounded-xl border p-3 text-sm ${entry.author === "client" ? "bg-warning/5" : "bg-surface/60"}`}>
                  <p className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{entry.author === "client" ? (entry.authorName ?? "Client") : "Vous"}</span>
                    <span>
                      {entry.quoteNumber} · {stamp.format(entry.createdAt)}
                    </span>
                  </p>
                  {entry.proposedTotal ? (
                    <p className="mt-1.5">
                      Budget proposé : <span className="font-semibold">{money(entry.proposedTotal)}</span>{" "}
                      <span className="text-muted-foreground">(devis : {money(quote.total)})</span>
                    </p>
                  ) : null}
                  {entry.requestedFeatures && <p className="mt-1.5 whitespace-pre-line"><span className="block text-muted-foreground">Fonctionnalités demandées :</span>{entry.requestedFeatures}</p>}
                  <p className="mt-1.5 whitespace-pre-line">{entry.message}</p>
                </li>
              ))}
            </ol>
          )}
          {OPEN_QUOTE_STATUSES.includes(quote.status) && (
            <div className="space-y-4 border-t pt-4">
              {drafts[0] ? (
                <Link href={`/admin/devis/emis/${drafts[0].id}`} className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground">
                  Reprendre la révision en cours
                </Link>
              ) : (
                <ConfirmButton
                  action={reviseQuoteAction.bind(null, quote.id)}
                  confirmText="Créer une nouvelle version de ce devis ? Elle remplacera celle-ci dès son envoi."
                  label="Réviser le devis (nouvelle version)"
                  variant="neutral"
                />
              )}
              <NegotiationReply action={replyNegotiationAction.bind(null, quote.id)} />
            </div>
          )}
        </section>
      )}
    </>
  );
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
            {negotiation}
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
            Un devis envoyé n&apos;est plus modifiable. Pour le réviser après une demande du client, utilisez « Réviser le devis » dans le panneau Négociation : la nouvelle version remplace celle-ci dès son envoi.
          </p>
        </div>

        <aside className="space-y-4">
          {negotiation}
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
                <div className="space-y-2 text-sm">
                  <p>Converti le {dateTime.format(quote.convertedAt)}.</p>
                  <div className="flex flex-wrap gap-2">
                    {quote.clientId && (
                      <Link href={`/admin/clients/${quote.clientId}`} className="inline-flex h-9 items-center rounded-xl border bg-card px-3 text-sm hover:bg-surface">
                        Fiche client
                      </Link>
                    )}
                    {quote.clientProjectId && (
                      <Link href={`/admin/clients/projets/${quote.clientProjectId}`} className="inline-flex h-9 items-center rounded-xl border bg-card px-3 text-sm hover:bg-surface">
                        Projet client
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <form action={convertQuoteAction.bind(null, id)} className="space-y-3">
                  <p className="text-sm text-muted-foreground">Crée en une fois le client, le projet client et, si vous le souhaitez, les jalons et la facture d&apos;acompte.</p>
                  <label className="block space-y-1.5 text-sm">
                    <span className="font-medium">Acompte (%)</span>
                    <input name="depositPercent" type="number" min={0} max={100} defaultValue={30} className="h-10 w-28 rounded-lg border bg-card px-3 text-sm" />
                    <span className="block text-xs text-muted-foreground">0 pour ne pas créer de facture d&apos;acompte.</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="milestones" value="1" defaultChecked className="size-4 accent-[var(--accent)]" />
                    Créer un jalon par ligne du devis
                  </label>
                  <button type="submit" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90">
                    Convertir
                  </button>
                </form>
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
