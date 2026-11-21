import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NewButton, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/guards";
import { billingReport, listInvoices } from "@/server/services/invoices";
import { INVOICE_STATUS } from "../clients/labels";

export const metadata: Metadata = { title: "Facturation" };

const FILTERS = [
  { value: "", label: "Toutes" },
  { value: "open", label: "À encaisser" },
  { value: "overdue", label: "En retard" },
  { value: "paid", label: "Payées" },
  { value: "draft", label: "Brouillons" },
  { value: "cancelled", label: "Annulées" },
];

const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  await requireAdmin();
  const { statut = "" } = await searchParams;
  const status = FILTERS.some((filter) => filter.value === statut) ? statut : "";
  const [rows, report] = await Promise.all([listInvoices({ status: status || undefined }), billingReport(1)]);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const cashed = report.monthly.filter((row) => row.month === thisMonth);

  return (
    <>
      <PageHeader
        title="Facturation"
        description="Factures, paiements et reçus. USD et CDF ne sont jamais additionnés."
        actions={
          <>
            <Link href="/admin/facturation/rapports" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm hover:bg-surface">
              <BarChart3 className="size-4" aria-hidden="true" /> Rapports
            </Link>
            <NewButton href="/admin/facturation/nouveau" label="Nouvelle facture" />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Reste à encaisser</p>
          <div className="mt-2 space-y-0.5">
            {report.outstanding.length === 0 ? (
              <p className="text-2xl font-semibold">0</p>
            ) : (
              report.outstanding.map((row) => (
                <p key={row.currency} className="text-2xl font-semibold tabular-nums">
                  {formatMoney(row.amount, row.currency)}
                </p>
              ))
            )}
          </div>
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Dont en retard</p>
          <div className="mt-2 space-y-0.5">
            {report.outstanding.filter((row) => row.overdue > 0).length === 0 ? (
              <p className="text-2xl font-semibold">0</p>
            ) : (
              report.outstanding
                .filter((row) => row.overdue > 0)
                .map((row) => (
                  <p key={row.currency} className="text-2xl font-semibold tabular-nums text-destructive">
                    {formatMoney(row.overdue, row.currency)}
                  </p>
                ))
            )}
          </div>
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Encaissé ce mois-ci</p>
          <div className="mt-2 space-y-0.5">
            {cashed.length === 0 ? (
              <p className="text-2xl font-semibold">0</p>
            ) : (
              cashed.map((row) => (
                <p key={row.currency} className="text-2xl font-semibold tabular-nums text-success">
                  {formatMoney(row.amount, row.currency)}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Filtrer les factures" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Link
            key={filter.value}
            href={filter.value ? `/admin/facturation?statut=${filter.value}` : "/admin/facturation"}
            aria-current={status === filter.value ? "page" : undefined}
            className={cn("inline-flex h-9 items-center rounded-full border px-3.5 text-sm", status === filter.value ? "border-accent bg-accent text-accent-foreground" : "bg-card hover:bg-surface")}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState>Aucune facture dans cette vue.</EmptyState>
      ) : (
        <div className="admin-card overflow-x-auto p-2">
          <table className="admin-table min-w-[760px]">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Client</th>
                <th>Échéance</th>
                <th>Total</th>
                <th>Solde</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ invoice, clientName }) => {
                const [label, tone] = INVOICE_STATUS[invoice.status];
                return (
                  <tr key={invoice.id}>
                    <td>
                      <Link href={`/admin/facturation/${invoice.id}`} className="font-mono text-xs font-medium hover:text-accent">
                        {invoice.number ?? "Brouillon"}
                      </Link>
                      <span className="block max-w-[220px] truncate text-xs text-muted-foreground">{invoice.title}</span>
                    </td>
                    <td>{clientName}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{day(invoice.dueDate)}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatMoney(invoice.total, invoice.currency)}</td>
                    <td className="whitespace-nowrap tabular-nums font-medium">{invoice.status === "cancelled" || invoice.status === "draft" ? "" : formatMoney(invoice.balance, invoice.currency)}</td>
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
    </>
  );
}
