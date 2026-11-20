import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/guards";
import { CONVERSATION_FILTERS, countByStatus, listConversations, type ConversationFilter } from "@/server/services/inbox-queries";

export const metadata: Metadata = { title: "Messagerie" };

const STATUS_LABELS: Record<string, string> = {
  all: "Tous",
  new: "Nouveaux",
  open: "Ouverts",
  replied: "Répondus",
  closed: "Fermés",
  spam: "Spam",
};
const STATUS_TONES = { new: "info", open: "warning", replied: "success", closed: "neutral", spam: "danger" } as const;

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string }> }) {
  await requireAdmin();
  const { statut = "all", q } = await searchParams;
  const filter = (CONVERSATION_FILTERS as readonly string[]).includes(statut) ? (statut as ConversationFilter) : "all";
  const [rows, counts] = await Promise.all([listConversations(filter, q), countByStatus()]);

  return (
    <>
      <PageHeader title="Messagerie" description="Messages du formulaire de contact et demandes de devis." />
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
          {CONVERSATION_FILTERS.map((value) => (
            <Link
              key={value}
              href={`/admin/messagerie?statut=${value}`}
              aria-current={filter === value ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                filter === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-surface",
              )}
            >
              {STATUS_LABELS[value]}
              {value !== "all" && counts[value] ? <span className="ml-1.5 font-mono text-xs opacity-80">{counts[value]}</span> : null}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          <input type="hidden" name="statut" value={filter} />
          <label htmlFor="q" className="sr-only">
            Rechercher
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Nom, e-mail, sujet" className="h-9 w-64 rounded-lg border bg-card px-3 text-sm" />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState>Aucune conversation.</EmptyState>
      ) : (
        <ul className="admin-card divide-y overflow-hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/messagerie/${row.id}`} className="flex gap-3 px-4 py-3 hover:bg-surface/40">
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", row.unread > 0 ? "bg-info" : "bg-transparent")} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={cn("truncate", row.unread > 0 ? "font-semibold" : "font-medium")}>{row.contactName}</span>
                    <span className="truncate text-xs text-muted-foreground">{row.contactEmail}</span>
                    {row.unread > 0 && <span className="sr-only">non lu</span>}
                  </span>
                  <span className="block truncate text-sm">{row.subject}</span>
                  <span className="block truncate text-sm text-muted-foreground">{row.excerpt}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <time className="text-xs text-muted-foreground" dateTime={row.lastMessageAt.toISOString()}>
                    {dateFormat.format(row.lastMessageAt)}
                  </time>
                  <Badge tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Badge>
                  {row.source === "quote_form" && <Badge>Devis</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
