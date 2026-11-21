import { ArrowRight, FileDown, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/admin/ui";
import { PortalMessageForm } from "@/components/portal/portal-forms";
import { formatMoney } from "@/lib/money";
import { portalMessageAction } from "@/server/actions/portal";
import { PAYMENT_METHOD_LABELS } from "@/server/services/invoices";
import { portalOverview, requirePortal } from "@/server/services/portal";

export const metadata: Metadata = { title: "Accueil" };

const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

const PROJECT_STATUS: Record<string, string> = {
  lead: "En discussion",
  planned: "Planifié",
  in_progress: "En cours",
  review: "En recette",
  on_hold: "En pause",
  delivered: "Livré",
  maintenance: "Maintenance",
  cancelled: "Annulé",
};

const INVOICE_STATUS = {
  sent: ["À régler", "info"],
  viewed: ["À régler", "info"],
  partially_paid: ["Partiellement réglée", "warning"],
  paid: ["Réglée", "success"],
  overdue: ["En retard", "danger"],
} as const;

const QUOTE_STATUS = {
  sent: ["En attente de réponse", "info"],
  viewed: ["En attente de réponse", "info"],
  accepted: ["Accepté", "success"],
  declined: ["Refusé", "neutral"],
  expired: ["Expiré", "neutral"],
} as const;

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  return (
    <section className="admin-card p-5 sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{empty ? <p className="text-sm text-muted-foreground">Rien pour le moment.</p> : children}</div>
    </section>
  );
}

export default async function PortalHome() {
  const { client, clientId } = await requirePortal();
  const data = await portalOverview(clientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bonjour {client.contactName ?? client.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Vos projets, devis, factures et reçus avec Isaac Akonkwa.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Solde à régler</p>
          {data.due.length === 0 ? (
            <p className="mt-1 text-2xl font-semibold text-success">Aucun</p>
          ) : (
            data.due.map((row) => (
              <p key={row.currency} className="mt-1 text-2xl font-semibold tabular-nums">
                {formatMoney(row.amount, row.currency)}
              </p>
            ))
          )}
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Projets</p>
          <p className="mt-1 text-2xl font-semibold">{data.projects.length}</p>
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Factures</p>
          <p className="mt-1 text-2xl font-semibold">{data.invoices.length}</p>
        </div>
      </div>

      <Section title="Mes projets" empty={data.projects.length === 0}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.projects.map(({ project, progress }) => (
            <li key={project.id}>
              <Link href={`/espace-client/projets/${project.id}`} className="group block rounded-xl border p-4 hover:border-accent">
                <span className="flex items-start justify-between gap-3">
                  <span className="font-medium">{project.name}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-accent" aria-hidden="true" />
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {PROJECT_STATUS[project.status]}
                  {project.dueDate ? ` · échéance ${day(project.dueDate)}` : ""}
                </span>
                <span className="mt-3 flex items-center gap-3">
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface" aria-hidden="true">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                  </span>
                  <span className="text-xs font-medium tabular-nums">{progress} %</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Mes factures" empty={data.invoices.length === 0}>
        <ul className="divide-y">
          {data.invoices.map((invoice) => {
            const [label, tone] = INVOICE_STATUS[invoice.status as keyof typeof INVOICE_STATUS] ?? ["", "neutral"];
            return (
              <li key={invoice.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{invoice.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-mono">{invoice.number}</span> · échéance {day(invoice.dueDate)}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">{formatMoney(invoice.status === "paid" ? invoice.total : invoice.balance, invoice.currency)}</span>
                  <Badge tone={tone}>{label}</Badge>
                  <a href={`/f/${invoice.publicToken}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface">
                    <FileText className="size-3.5" aria-hidden="true" /> Voir
                  </a>
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="grid gap-6 *:min-w-0 lg:grid-cols-2">
        <Section title="Mes devis" empty={data.quotes.length === 0}>
          <ul className="divide-y">
            {data.quotes.map((quote) => {
              const [label, tone] = QUOTE_STATUS[quote.status as keyof typeof QUOTE_STATUS] ?? ["", "neutral"];
              return (
                <li key={quote.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <a href={`/f/${quote.publicToken}`} className="block truncate font-medium hover:text-accent">
                      {quote.title}
                    </a>
                    <span className="block text-xs text-muted-foreground">
                      <span className="font-mono">{quote.number}</span> · {formatMoney(quote.total, quote.currency)}
                    </span>
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="Mes reçus" empty={data.receipts.length === 0}>
          <ul className="divide-y">
            {data.receipts.map(({ receipt, payment, invoiceNumber }) => (
              <li key={receipt.id} className="flex items-center justify-between gap-3 py-3">
                <span>
                  <span className="block font-medium tabular-nums">{formatMoney(payment.amount, payment.currency)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {day(payment.paidAt)} · {PAYMENT_METHOD_LABELS[payment.method].fr} · {invoiceNumber}
                  </span>
                </span>
                <a href={`/f/${receipt.publicToken}/pdf`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 font-mono text-xs hover:bg-surface">
                  <FileDown className="size-3.5" aria-hidden="true" /> {receipt.number}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="Écrire à Isaac">
        <PortalMessageForm action={portalMessageAction.bind(null, null)} />
      </Section>
    </div>
  );
}
