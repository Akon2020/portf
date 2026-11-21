import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { createQuoteDraftAction } from "@/server/actions/quotes";
import { requireAdmin } from "@/server/auth/guards";
import { listQuotes } from "@/server/services/quotes";
import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "./labels";

export const metadata: Metadata = { title: "Devis émis" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "UTC" });

export default async function IssuedQuotesPage() {
  await requireAdmin();
  const rows = await listQuotes();
  const pending = (currency: "USD" | "CDF") =>
    rows.filter((row) => row.currency === currency && ["sent", "viewed"].includes(row.status)).reduce((sum, row) => sum + row.total, 0);

  return (
    <>
      <PageHeader
        title="Devis émis"
        description={`En attente de réponse : ${formatMoney(pending("USD"), "USD")} et ${formatMoney(pending("CDF"), "CDF")}`}
        actions={
          <form action={createQuoteDraftAction}>
            <Button type="submit" size="sm">
              + Nouveau devis
            </Button>
          </form>
        }
      />
      {rows.length === 0 ? (
        <EmptyState>Aucun devis pour le moment. Créez-en un depuis une demande, une conversation ou ce bouton.</EmptyState>
      ) : (
        <div className="admin-card overflow-x-auto p-2">
          <table className="admin-table min-w-[680px]">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium">Numéro</th>
                <th className="px-4 py-3 font-medium">Client et objet</th>
                <th className="px-4 py-3 font-medium">Validité</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((quote) => (
                <tr key={quote.id} className="hover:bg-surface/40">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link href={`/admin/devis/emis/${quote.id}`} className="hover:text-accent">
                      {quote.number ?? "Brouillon"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/devis/emis/${quote.id}`} className="font-medium hover:text-accent">
                      {quote.recipientName}
                    </Link>
                    <span className="block text-muted-foreground">{quote.title}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dateFormat.format(new Date(`${quote.validUntil}T12:00:00Z`))}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">{formatMoney(quote.total, quote.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={QUOTE_STATUS_TONES[quote.status]}>{QUOTE_STATUS_LABELS[quote.status]}</Badge>
                    {quote.convertedAt && <span className="ml-1.5 text-xs text-success">converti</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
