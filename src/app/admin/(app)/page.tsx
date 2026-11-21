import { ArrowUpRight, FileText, Inbox, ListChecks, Newspaper, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import { requireAdmin } from "@/server/auth/guards";
import { AreaChart, BarChart, Donut } from "@/components/admin/charts";
import { actionLabel, dashboardCharts, dashboardData } from "@/server/content/dashboard";
import { REQUEST_LABELS } from "@/server/services/quote-requests";

export const metadata: Metadata = { title: "Tableau de bord" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeZone: "Africa/Lubumbashi" });
const hourFormat = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Africa/Lubumbashi" });

const MESSAGE_TONES = { new: "info", open: "warning", replied: "success", closed: "neutral", spam: "danger" } as const;
const MESSAGE_LABELS = { new: "Nouveau", open: "Ouvert", replied: "Répondu", closed: "Fermé", spam: "Spam" } as const;

function StatCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint: string;
  href: string;
  icon: typeof Inbox;
  tone: string;
}) {
  return (
    <Link href={href} className="admin-card group flex min-w-0 flex-col justify-between gap-3 p-4 transition-shadow hover:shadow-md sm:gap-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-10 ${tone}`}>
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
      </div>
      <div>
        <p className="break-words text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{value}</p>
        <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          {hint}
          <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        </p>
      </div>
    </Link>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="admin-card flex min-w-0 flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="text-sm font-medium text-accent hover:underline">
            {linkLabel ?? "Tout voir"}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const { user } = await requireAdmin();
  const [data, charts] = await Promise.all([dashboardData(user.id), dashboardCharts()]);
  const dayTick = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
  const monthTick = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
  const monthLong = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  const visits = charts.visits.map((row, index) => ({
    label: row.day,
    tick: index % 7 === 0 || index === charts.visits.length - 1 ? dayTick.format(new Date(`${row.day}T12:00:00Z`)) : "",
    value: row.views,
  }));
  const totalVisits = charts.visits.reduce((sum, row) => sum + row.views, 0);
  const currencies = (["USD", "CDF"] as const).filter((currency) => charts.revenue.some((row) => row.currency === currency && row.amount > 0));
  const revenueCurrencies = currencies.length ? currencies : (["USD"] as const);
  const STATUS_FR: Record<string, string> = {
    draft: "Brouillon", sent: "Envoyé", viewed: "Consulté", accepted: "Accepté", declined: "Refusé", expired: "Expiré", negotiating: "En négociation", revised: "Révisé",
    partially_paid: "Partiel", paid: "Payée", overdue: "En retard", cancelled: "Annulée",
    new: "Nouvelle", reviewing: "En analyse", quoted: "Devis envoyé", won: "Gagnée", lost: "Perdue",
    todo: "À faire", in_progress: "En cours", blocked: "Bloquée", done: "Terminée",
  };
  const segments = (rows: { status: string; count: number }[]) => rows.map((row) => ({ label: STATUS_FR[row.status] ?? row.status, value: row.count })).sort((a, b) => b.value - a.value);
  const now = new Date();
  const hour = Number(hourFormat.format(now));
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const firstName = user.name.split(" ")[0];
  const pending = data.quotesByCurrency.filter((row) => row.pending > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground first-letter:uppercase">{longDate.format(now)}</p>
        </div>
      </div>

      {!data.account?.totpEnabledAt && (
        <Link href="/admin/securite" className="admin-card flex items-center gap-4 border-warning/40 p-4 hover:shadow-md">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
            <ShieldAlert className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Double authentification désactivée</span>
            <span className="block text-sm text-muted-foreground">Activez-la pour protéger le compte en cas de vol du mot de passe.</span>
          </span>
          <span className="hidden text-sm font-medium text-accent sm:block">Activer</span>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Messages à traiter"
          value={data.totals.open_messages}
          hint={`${data.totals.new_messages} nouveaux`}
          href="/admin/messagerie"
          icon={Inbox}
          tone="bg-info/10 text-info"
        />
        <StatCard
          label="Demandes de devis"
          value={data.totals.new_requests}
          hint="Nouvelles ou en analyse"
          href="/admin/devis"
          icon={FileText}
          tone="bg-accent/10 text-accent"
        />
        <StatCard
          label="Devis en attente"
          value={pending.length ? pending.map((row) => formatMoney(row.pending, row.currency)).join(" · ") : "0"}
          hint={`${pending.reduce((sum, row) => sum + row.count, 0)} devis envoyés sans réponse`}
          href="/admin/devis/emis"
          icon={FileText}
          tone="bg-success/10 text-success"
        />
        <StatCard
          label="À valider"
          value={data.totals.to_review}
          hint={`${data.totals.published_projects} projets et ${data.totals.published_posts} articles publiés`}
          href="/admin/a-valider"
          icon={ListChecks}
          tone="bg-warning/10 text-warning"
        />
      </div>

      <div className="grid gap-4 *:min-w-0 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Visites des 30 derniers jours" href="/admin/monitoring" linkLabel="Audience">
          <p className="-mt-2 mb-3 text-sm text-muted-foreground">{totalVisits.toLocaleString("fr-FR")} pages vues</p>
          <AreaChart points={visits} caption="Pages vues par jour sur les 30 derniers jours" />
        </Panel>
        <Panel title="Encaissements sur 12 mois" href="/admin/facturation/rapports" linkLabel="Rapports">
          <div className="space-y-5">
            {revenueCurrencies.map((currency) => (
              <div key={currency}>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{currency}</p>
                <BarChart
                  caption={`Encaissements mensuels en ${currency}`}
                  format={(value) => formatMoney(value, currency)}
                  tone={currency === "USD" ? "bg-success/80" : "bg-info/80"}
                  points={charts.revenue
                    .filter((row) => row.currency === currency)
                    .map((row, index) => ({
                      label: monthLong.format(new Date(`${row.month}-15T12:00:00Z`)),
                      tick: index % 2 === 0 ? monthTick.format(new Date(`${row.month}-15T12:00:00Z`)) : "",
                      value: row.amount,
                    }))}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 *:min-w-0 md:grid-cols-2 2xl:grid-cols-4">
        <Panel title="Demandes de devis" href="/admin/devis">
          <Donut segments={segments(charts.requestStatuses)} caption="Demandes de devis par statut" centerLabel="demandes" />
        </Panel>
        <Panel title="Devis émis" href="/admin/devis/emis">
          <Donut segments={segments(charts.quoteStatuses)} caption="Devis émis par statut" centerLabel="devis" />
        </Panel>
        <Panel title="Factures" href="/admin/facturation">
          <Donut segments={segments(charts.invoiceStatuses)} caption="Factures par statut" centerLabel="factures" />
        </Panel>
        <Panel title="Tâches" href="/admin/taches">
          <Donut segments={segments(charts.taskStatuses)} caption="Tâches par statut" centerLabel="tâches" />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Derniers messages" href="/admin/messagerie">
          {data.recentMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun message pour le moment.</p>
          ) : (
            <ul className="-mx-2 divide-y">
              {data.recentMessages.map((message) => (
                <li key={message.id}>
                  <Link href={`/admin/messagerie/${message.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-surface/60">
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-xs font-semibold">
                      {message.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{message.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{message.subject}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={MESSAGE_TONES[message.status]}>{MESSAGE_LABELS[message.status]}</Badge>
                      <time className="text-[11px] text-muted-foreground" dateTime={message.at.toISOString()}>
                        {dateTime.format(message.at)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Activité récente">
          {data.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune activité enregistrée.</p>
          ) : (
            <ol className="space-y-3">
              {data.activity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block">{actionLabel(entry.action)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.actor ?? "Visiteur ou système"} · {dateTime.format(entry.at)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Dernières demandes de devis" href="/admin/devis">
          {data.recentRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
          ) : (
            <div className="-mx-2 overflow-x-auto">
              <table className="admin-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Projet</th>
                    <th>Budget</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentRequests.map((request) => (
                    <tr key={request.id}>
                      <td>
                        <Link href={`/admin/devis/${request.id}`} className="font-medium hover:text-accent">
                          {request.company ?? request.name}
                        </Link>
                      </td>
                      <td className="text-muted-foreground">{REQUEST_LABELS.projectType[request.type as keyof typeof REQUEST_LABELS.projectType] ?? request.type}</td>
                      <td className="whitespace-nowrap text-muted-foreground">{REQUEST_LABELS.budget[request.budget as keyof typeof REQUEST_LABELS.budget] ?? "Non précisé"}</td>
                      <td>
                        <Badge tone={request.status === "won" ? "success" : request.status === "lost" ? "danger" : "info"}>{REQUEST_LABELS.status[request.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Sécurité" href="/admin/securite" linkLabel="Gérer">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Double authentification</dt>
            <dd className="flex items-center gap-1.5">
              {data.account?.totpEnabledAt ? (
                <>
                  <ShieldCheck className="size-4 text-success" aria-hidden="true" /> Active
                </>
              ) : (
                <Badge tone="warning">Désactivée</Badge>
              )}
            </dd>
            {data.account?.totpEnabledAt && (
              <>
                <dt className="text-muted-foreground">Codes de secours</dt>
                <dd>{data.totals.backup_codes} sur 10</dd>
              </>
            )}
            <dt className="text-muted-foreground">Événements (24 h)</dt>
            <dd>
              <Link href="/admin/monitoring/securite" className="hover:text-accent">
                {data.totals.security_events}
              </Link>
            </dd>
            <dt className="text-muted-foreground">IP bannies actives</dt>
            <dd>
              <Link href="/admin/monitoring/bannissements" className="hover:text-accent">
                {data.totals.active_bans}
              </Link>
            </dd>
            <dt className="text-muted-foreground">Dernière connexion</dt>
            <dd>{data.account?.lastLoginAt ? `${dateTime.format(data.account.lastLoginAt)}` : "Aucune"}</dd>
          </dl>
          <ul className="mt-4 space-y-2 border-t pt-4 text-xs">
            {data.attempts.map((attempt) => (
              <li key={attempt.id} className="flex items-center justify-between gap-3">
                <span className={attempt.success ? "text-success" : "text-destructive"}>{attempt.success ? "Réussie" : "Échouée"}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">{attempt.ip}</span>
                <time className="shrink-0 text-muted-foreground" dateTime={attempt.createdAt.toISOString()}>
                  {dateTime.format(attempt.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/taches" className="admin-card flex items-center gap-3 p-4 text-sm font-medium hover:shadow-md sm:col-span-3">
          <ListChecks className="size-5 text-accent" aria-hidden="true" /> Tâches du jour : {data.totals.tasks_today}
          <span className={`ml-auto text-xs ${data.totals.tasks_overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>{data.totals.tasks_overdue} en retard</span>
        </Link>
        <Link href="/admin/blog/nouveau" className="admin-card flex items-center gap-3 p-4 text-sm font-medium hover:shadow-md">
          <Newspaper className="size-5 text-accent" aria-hidden="true" /> Écrire un article
          <span className="ml-auto text-xs text-muted-foreground">{data.totals.draft_posts} brouillons</span>
        </Link>
        <Link href="/admin/contenu/projets/nouveau" className="admin-card flex items-center gap-3 p-4 text-sm font-medium hover:shadow-md">
          <FileText className="size-5 text-accent" aria-hidden="true" /> Ajouter un projet
        </Link>
        <Link href="/admin/devis/emis/nouveau" className="admin-card flex items-center gap-3 p-4 text-sm font-medium hover:shadow-md">
          <FileText className="size-5 text-accent" aria-hidden="true" /> Créer un devis
        </Link>
      </div>
    </div>
  );
}
