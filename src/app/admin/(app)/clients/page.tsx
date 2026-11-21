import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NewButton, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { listClients } from "@/server/services/clients";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const rows = await listClients(q);

  return (
    <>
      <PageHeader title="Clients" description={`${rows.length} fiches`} actions={<NewButton href="/admin/clients/nouveau" label="Nouveau client" />} />
      <form role="search" className="mb-5 flex max-w-md gap-2">
        <label htmlFor="client-search" className="sr-only">
          Rechercher un client
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input id="client-search" name="q" type="search" defaultValue={q} placeholder="Nom, e-mail, ville..." className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm" />
        </div>
        <button type="submit" className="h-10 rounded-xl border bg-card px-4 text-sm hover:bg-surface">
          Rechercher
        </button>
      </form>
      {rows.length === 0 ? (
        <EmptyState>{q ? "Aucun client ne correspond à cette recherche." : "Aucun client. Convertissez un devis accepté ou créez une fiche."}</EmptyState>
      ) : (
        <div className="admin-card overflow-x-auto p-2">
          <table className="admin-table min-w-[720px]">
            <thead>
              <tr>
                <th>Client</th>
                <th>Contact</th>
                <th>Projets</th>
                <th>Solde dû</th>
                <th>Espace</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((client) => (
                <tr key={client.id}>
                  <td>
                    <Link href={`/admin/clients/${client.id}`} className="font-medium hover:text-accent">
                      {client.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{[client.type === "company" ? "Organisation" : "Particulier", client.city].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="text-muted-foreground">
                    <span className="block">{client.email ?? "Pas d'e-mail"}</span>
                    {client.whatsapp && <span className="block font-mono text-xs">{client.whatsapp}</span>}
                  </td>
                  <td className="tabular-nums">{client.projects}</td>
                  <td className="whitespace-nowrap tabular-nums">
                    {client.due.length === 0 ? <span className="text-muted-foreground">Rien</span> : client.due.map((row) => <span key={row.currency} className="block font-medium">{formatMoney(row.amount, row.currency)}</span>)}
                  </td>
                  <td>{client.portalEnabled ? <Badge tone="success">Actif</Badge> : <Badge>Fermé</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
