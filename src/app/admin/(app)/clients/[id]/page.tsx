import { FolderPlus, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientForm, ResultButton } from "@/components/admin/crm-forms";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { deleteClientAction, saveClientAction, setPortalAccessAction } from "@/server/actions/crm";
import { requireAdmin } from "@/server/auth/guards";
import { getClientDetail } from "@/server/services/clients";
import { PAYMENT_METHOD_LABELS } from "@/server/services/invoices";
import { INVOICE_STATUS, PROJECT_STATUS } from "../labels";

export const metadata: Metadata = { title: "Client" };

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Africa/Lubumbashi" });
const day = (value: string) => date.format(new Date(`${value}T12:00:00Z`));

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="admin-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (id === "nouveau") {
    return (
      <>
        <PageHeader title="Nouveau client" back={{ href: "/admin/clients", label: "Clients" }} />
        <ClientForm action={saveClientAction.bind(null, null)} />
      </>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getClientDetail(id);
  if (!detail) notFound();
  const { client } = detail;

  return (
    <>
      <PageHeader
        title={client.name}
        back={{ href: "/admin/clients", label: "Clients" }}
        description={[client.contactName, client.email, client.whatsapp].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <Link href={`/admin/facturation/nouveau?client=${client.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90">
              <Receipt className="size-4" aria-hidden="true" /> Nouvelle facture
            </Link>
            <ResultButton action={deleteClientAction.bind(null, client.id)} label="Supprimer" tone="danger" confirmText="Supprimer cette fiche client ? Elle sera archivée." />
          </>
        }
      />

      <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel
            title="Projets"
            action={
              <Link href={`/admin/clients/projets/nouveau?client=${client.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface">
                <FolderPlus className="size-3.5" aria-hidden="true" /> Nouveau projet
              </Link>
            }
          >
            {detail.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun projet pour ce client.</p>
            ) : (
              <ul className="divide-y">
                {detail.projects.map((project) => {
                  const [label, tone] = PROJECT_STATUS[project.status];
                  return (
                    <li key={project.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <Link href={`/admin/clients/projets/${project.id}`} className="font-medium hover:text-accent">
                        {project.name}
                      </Link>
                      <span className="flex items-center gap-2 text-sm text-muted-foreground">
                        {project.dueDate && <span>Échéance {day(project.dueDate)}</span>}
                        <Badge tone={tone}>{label}</Badge>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Factures">
            {detail.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune facture.</p>
            ) : (
              <div className="-mx-2 overflow-x-auto">
                <table className="admin-table min-w-[560px]">
                  <thead>
                    <tr>
                      <th>Numéro</th>
                      <th>Objet</th>
                      <th>Total</th>
                      <th>Solde</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.invoices.map((invoice) => {
                      const [label, tone] = INVOICE_STATUS[invoice.status];
                      return (
                        <tr key={invoice.id}>
                          <td>
                            <Link href={`/admin/facturation/${invoice.id}`} className="font-mono text-xs hover:text-accent">
                              {invoice.number ?? "Brouillon"}
                            </Link>
                          </td>
                          <td className="max-w-[220px] truncate">{invoice.title}</td>
                          <td className="whitespace-nowrap tabular-nums">{formatMoney(invoice.total, invoice.currency)}</td>
                          <td className="whitespace-nowrap tabular-nums">{invoice.status === "cancelled" ? "" : formatMoney(invoice.balance, invoice.currency)}</td>
                          <td>
                            <Badge tone={tone}>{label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <details className="admin-card p-5">
            <summary className="cursor-pointer text-base font-semibold">Modifier la fiche</summary>
            <div className="mt-5">
              <ClientForm action={saveClientAction.bind(null, client.id)} client={client} />
            </div>
          </details>
        </div>

        <div className="space-y-6">
          <Panel title="Solde dû">
            {detail.due.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune somme en attente.</p>
            ) : (
              <ul className="space-y-1">
                {detail.due.map((row) => (
                  <li key={row.currency} className="text-2xl font-semibold tabular-nums">
                    {formatMoney(row.amount, row.currency)}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Espace client">
            <p className="mb-3 text-sm text-muted-foreground">
              {client.portalEnabled
                ? "Le client se connecte avec un lien envoyé à son e-mail et voit ses projets, devis, factures et reçus."
                : "Fermé. Une fois ouvert, le client se connecte sur /espace-client avec un lien envoyé par e-mail."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {client.portalEnabled ? <Badge tone="success">Actif</Badge> : <Badge>Fermé</Badge>}
              <ResultButton action={setPortalAccessAction.bind(null, client.id, !client.portalEnabled)} label={client.portalEnabled ? "Fermer l'accès" : "Ouvrir l'accès"} />
            </div>
          </Panel>

          <Panel title="Paiements reçus">
            {detail.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.payments.slice(0, 10).map(({ payment, invoiceNumber }) => (
                  <li key={payment.id} className="flex justify-between gap-3">
                    <span>
                      <span className="block font-medium tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {day(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method].fr}
                      </span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{invoiceNumber}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Devis">
            {detail.quotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun devis.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/admin/devis/emis/${quote.id}`} className="flex justify-between gap-3 hover:text-accent">
                      <span className="truncate">{quote.title}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{quote.number ?? "Brouillon"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Échanges">
            {detail.conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune conversation.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.conversations.map((conversation) => (
                  <li key={conversation.id}>
                    <Link href={`/admin/messagerie/${conversation.id}`} className="block truncate hover:text-accent">
                      {conversation.subject}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {client.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-line text-sm">{client.notes}</p>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
