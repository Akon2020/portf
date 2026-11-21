import { Download } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { formatMoney, type Currency } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { PAYMENT_METHOD_LABELS, billingReport } from "@/server/services/invoices";

export const metadata: Metadata = { title: "Rapports de facturation" };

const monthLabel = (month: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));

function lastMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 15));
    return date.toISOString().slice(0, 7);
  });
}

/** Monthly revenue of one currency as accessible bars (a table for screen readers). */
function MonthlyChart({ currency, values }: { currency: Currency; values: { month: string; amount: number }[] }) {
  const max = Math.max(...values.map((value) => value.amount), 1);
  const total = values.reduce((sum, value) => sum + value.amount, 0);
  return (
    <section className="admin-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Encaissements en {currency}</h2>
        <p className="text-sm text-muted-foreground">
          12 mois : <span className="font-semibold text-foreground tabular-nums">{formatMoney(total, currency)}</span>
        </p>
      </div>
      <div aria-hidden="true" className="mt-6 flex h-44 items-end gap-1.5 sm:gap-2">
        {values.map((value) => (
          <div key={value.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div className="w-full rounded-t-md bg-accent/85 transition-all" style={{ height: `${Math.max(value.amount ? 3 : 0, (value.amount / max) * 100)}%` }} title={formatMoney(value.amount, currency)} />
            <span className="text-[10px] text-muted-foreground">{monthLabel(value.month)}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Encaissements mensuels en {currency}</caption>
        <tbody>
          {values.map((value) => (
            <tr key={value.month}>
              <th scope="row">{monthLabel(value.month)}</th>
              <td>{formatMoney(value.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  const report = await billingReport(12);
  const months = lastMonths(12);
  const currencies = (["USD", "CDF"] as Currency[]).filter((currency) => report.monthly.some((row) => row.currency === currency) || currency === "USD");

  return (
    <>
      <PageHeader
        title="Rapports"
        back={{ href: "/admin/facturation", label: "Facturation" }}
        description="Montants encaissés par mois et par devise. USD et CDF ne sont jamais additionnés."
        actions={
          <a href="/admin/facturation/export.csv" className="inline-flex h-10 items-center gap-1.5 rounded-xl border bg-card px-3.5 text-sm hover:bg-surface">
            <Download className="size-4" aria-hidden="true" /> Export CSV
          </a>
        }
      />
      <div className="space-y-6">
        <div className="grid gap-6 *:min-w-0 xl:grid-cols-2">
          {currencies.map((currency) => (
            <MonthlyChart
              key={currency}
              currency={currency}
              values={months.map((month) => ({ month, amount: report.monthly.find((row) => row.month === month && row.currency === currency)?.amount ?? 0 }))}
            />
          ))}
        </div>

        <div className="grid gap-6 *:min-w-0 xl:grid-cols-3">
          <section className="admin-card p-5">
            <h2 className="text-base font-semibold">Impayés</h2>
            {report.outstanding.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Aucune facture en attente.</p>
            ) : (
              <dl className="mt-3 space-y-3">
                {report.outstanding.map((row) => (
                  <div key={row.currency}>
                    <dt className="text-sm text-muted-foreground">
                      {row.count} facture{row.count > 1 ? "s" : ""} en {row.currency}
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums">{formatMoney(row.amount, row.currency)}</dd>
                    {row.overdue > 0 && <dd className="text-sm text-destructive">dont {formatMoney(row.overdue, row.currency)} en retard</dd>}
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="admin-card p-5">
            <h2 className="text-base font-semibold">Meilleurs clients (12 mois)</h2>
            {report.topClients.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Aucun paiement sur la période.</p>
            ) : (
              <ol className="mt-3 space-y-2 text-sm">
                {report.topClients.slice(0, 8).map((row) => (
                  <li key={`${row.client_id}-${row.currency}`} className="flex justify-between gap-3">
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">{formatMoney(row.amount, row.currency)}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="admin-card p-5">
            <h2 className="text-base font-semibold">Moyens de paiement</h2>
            {report.byMethod.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Aucun paiement sur la période.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {report.byMethod.map((row) => (
                  <li key={`${row.method}-${row.currency}`} className="flex justify-between gap-3">
                    <span>{PAYMENT_METHOD_LABELS[row.method].fr}</span>
                    <span className="font-medium tabular-nums">{formatMoney(row.amount, row.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
