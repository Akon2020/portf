import { FilePlus2, Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton, Badge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { whatsappLink } from "@/lib/whatsapp";
import { createQuoteDraftAction, setRequestStatusAction } from "@/server/actions/quotes";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { contacts, quoteRequests, quotes } from "@/server/db/schema";
import { REQUEST_LABELS } from "@/server/services/quote-requests";

export const metadata: Metadata = { title: "Demande de devis" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </>
  );
}

export default async function QuoteRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [row] = await db
    .select({ request: quoteRequests, contact: contacts })
    .from(quoteRequests)
    .innerJoin(contacts, eq(contacts.id, quoteRequests.contactId))
    .where(eq(quoteRequests.id, id))
    .limit(1);
  if (!row) notFound();
  const { request, contact } = row;
  const linkedQuotes = await db
    .select({ id: quotes.id, number: quotes.number, status: quotes.status })
    .from(quotes)
    .where(and(eq(quotes.quoteRequestId, id), isNull(quotes.deletedAt)));
  const L = REQUEST_LABELS;
  const wa = contact.phone ? whatsappLink(contact.phone) : null;
  const knownFeatures = new Set(Object.keys(L.features));

  return (
    <>
      <PageHeader
        title={`${L.projectType[request.projectType as keyof typeof L.projectType] ?? request.projectType} : ${contact.company ?? contact.name}`}
        back={{ href: "/admin/devis", label: "Demandes" }}
        description={`Reçue le ${dateFormat.format(request.createdAt)}`}
        actions={
          <>
            <form action={createQuoteDraftAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit" size="sm">
                <FilePlus2 aria-hidden="true" />
                Créer un devis
              </Button>
            </form>
            {request.conversationId && (
              <Link href={`/admin/messagerie/${request.conversationId}`} className="inline-flex h-7 items-center rounded-lg border px-2.5 text-xs hover:bg-surface">
                Conversation
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Description</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.description}</p>
          </section>
          <section className="rounded-xl border bg-card p-5">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <Row label="Budget">{L.budget[request.budgetRange as keyof typeof L.budget] ?? "Non précisé"}</Row>
              <Row label="Devise de paiement">{request.currency}</Row>
              <Row label="Délai">{L.deadline[request.deadline as keyof typeof L.deadline] ?? "Non précisé"}</Row>
              <Row label="Maquettes">{request.hasDesign ? "Oui" : "Non"}</Row>
              <Row label="Services">{request.services.join(", ") || "Aucun"}</Row>
              <Row label="Fonctionnalités">
                {request.features.length
                  ? request.features.map((feature) => (knownFeatures.has(feature) ? L.features[feature as keyof typeof L.features] : feature)).join(", ")
                  : "Aucune"}
              </Row>
              <Row label="Références">
                {request.referenceLinks.length ? (
                  <ul>
                    {request.referenceLinks.map((link) => (
                      <li key={link}>
                        <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="break-all underline underline-offset-4">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  "Aucune"
                )}
              </Row>
              <Row label="Langue">{request.locale.toUpperCase()}</Row>
            </dl>
          </section>
          {request.attachments.length > 0 && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-3 font-sans text-base font-semibold tracking-normal">Pièces jointes</h2>
              <ul className="flex flex-wrap gap-2">
                {request.attachments.map((file) => (
                  <li key={file.id}>
                    <a href={`/api/admin/fichiers/${file.id}`} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-surface">
                      <Paperclip className="size-4" aria-hidden="true" />
                      {file.name} <span className="text-xs text-muted-foreground">{Math.ceil(file.size / 1024)} Ko</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-sans text-base font-semibold tracking-normal">Contact</h2>
            <p className="text-sm">
              <span className="block font-medium">{contact.name}</span>
              {contact.company && <span className="block text-muted-foreground">{contact.company}</span>}
              <a href={`mailto:${contact.email}`} className="block underline underline-offset-4">
                {contact.email}
              </a>
              {contact.phone && <span className="block">{contact.phone}</span>}
            </p>
            <p className="text-sm">
              Préfère : <Badge>{L.channel[request.preferredContact]}</Badge>
            </p>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg border px-2.5 text-xs hover:bg-surface">
                Ouvrir WhatsApp
              </a>
            )}
          </section>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-sans text-base font-semibold tracking-normal">Statut</h2>
            <p>
              <Badge tone="info">{L.status[request.status]}</Badge>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(L.status) as (keyof typeof L.status)[])
                .filter((status) => status !== request.status)
                .map((status) => (
                  <ActionButton key={status} action={setRequestStatusAction.bind(null, request.id, status)} label={L.status[status]} />
                ))}
            </div>
          </section>
          {linkedQuotes.length > 0 && (
            <section className="space-y-2 rounded-xl border bg-card p-5">
              <h2 className="font-sans text-base font-semibold tracking-normal">Devis liés</h2>
              <ul className="space-y-1 text-sm">
                {linkedQuotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/admin/devis/emis/${quote.id}`} className="underline underline-offset-4">
                      {quote.number ?? "Brouillon"}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
