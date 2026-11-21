import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/admin/monitoring";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/guards";
import { securityCounters, securityOverview } from "@/server/services/monitoring";
import { ACTION_TAKEN, CATEGORY_LABELS, SEVERITY } from "../labels";

export const metadata: Metadata = { title: "Sécurité" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Africa/Lubumbashi" });
const select = "h-10 rounded-lg border bg-card px-3 text-sm";

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ categorie?: string; gravite?: string; ip?: string; jours?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const days = [1, 7, 30, 90].includes(Number(query.jours)) ? Number(query.jours) : 7;
  const category = query.categorie && query.categorie in CATEGORY_LABELS ? query.categorie : undefined;
  const severity = query.gravite && query.gravite in SEVERITY ? query.gravite : undefined;
  const ip = query.ip?.trim().slice(0, 64) || undefined;
  const [data, counters] = await Promise.all([securityOverview({ category, severity, ip, days }), securityCounters()]);
  const maxDaily = Math.max(1, ...data.daily.map((row) => row.count));

  return (
    <>
      <PageHeader title="Sécurité" description="Tentatives détectées par le moteur de règles et signaux de l'application (connexions, jetons, formulaires)." />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Événements (24 h)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{counters.events}</p>
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Graves (24 h)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-warning">{counters.critical}</p>
        </div>
        <Link href="/admin/monitoring/bannissements" className="admin-card p-5 hover:shadow-md">
          <p className="text-sm text-muted-foreground">IP bannies actives</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-destructive">{counters.bans}</p>
        </Link>
      </div>

      <form className="admin-card mt-6 flex flex-wrap items-end gap-3 p-4" role="search">
        <label className="space-y-1 text-xs font-medium">
          Catégorie
          <select name="categorie" defaultValue={category ?? ""} className={`${select} block`}>
            <option value="">Toutes</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Gravité
          <select name="gravite" defaultValue={severity ?? ""} className={`${select} block`}>
            <option value="">Toutes</option>
            {Object.entries(SEVERITY).map(([value, [label]]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Période
          <select name="jours" defaultValue={String(days)} className={`${select} block`}>
            <option value="1">24 heures</option>
            <option value="7">7 jours</option>
            <option value="30">30 jours</option>
            <option value="90">90 jours</option>
          </select>
        </label>
        <label className="min-w-40 flex-1 space-y-1 text-xs font-medium">
          IP (début)
          <input name="ip" defaultValue={ip} className={`${select} block w-full font-mono`} />
        </label>
        <button type="submit" className="h-10 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground">
          Filtrer
        </button>
      </form>

      <div className="mt-6 grid gap-6 *:min-w-0 lg:grid-cols-3">
        <section className="admin-card p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">Événements par jour</h2>
          <div aria-hidden="true" className="mt-5 flex h-32 items-end gap-[3px]">
            {data.daily.map((row) => (
              <div key={row.day} className="flex h-full flex-1 flex-col justify-end" title={`${row.day} : ${row.count}`}>
                <div className="rounded-t-sm bg-destructive/70" style={{ height: `${Math.max(2, (row.count / maxDaily) * 100)}%` }} />
              </div>
            ))}
          </div>
          {data.daily.length === 0 && <p className="text-sm text-muted-foreground">Aucun événement sur la période.</p>}
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Par catégorie</h2>
          <BarList rows={data.byCategory.map((row) => ({ label: CATEGORY_LABELS[row.category] ?? row.category, value: row.count }))} />
        </section>
      </div>

      <div className="mt-6 grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="admin-card overflow-x-auto p-2">
          <table className="admin-table min-w-[820px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>IP</th>
                <th>Méthode tentée</th>
                <th>Requête</th>
                <th>Gravité</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground">
                    Aucun événement.
                  </td>
                </tr>
              ) : (
                data.events.map((event) => {
                  const [label, tone] = SEVERITY[event.severity];
                  return (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(event.createdAt)}</td>
                      <td>
                        <Link href={`/admin/monitoring/ip/${encodeURIComponent(event.ip)}`} className="font-mono text-xs hover:text-accent">
                          {event.ip}
                        </Link>
                      </td>
                      <td className="text-xs">
                        <span className="block font-medium">{CATEGORY_LABELS[event.category]}</span>
                        <span className="font-mono text-muted-foreground">{event.ruleId}</span>
                      </td>
                      <td className="max-w-[280px]">
                        <span className="block truncate font-mono text-xs">
                          {event.method} {event.path}
                          {event.query}
                        </span>
                        {event.payloadExcerpt && <span className="block truncate font-mono text-[11px] text-muted-foreground">{event.payloadExcerpt}</span>}
                      </td>
                      <td>
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td className="text-xs">{ACTION_TAKEN[event.actionTaken]}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
        <section className="admin-card h-fit p-5">
          <h2 className="mb-3 text-base font-semibold">IP les plus actives</h2>
          <BarList rows={data.topIps.map((row) => ({ label: row.ip, value: row.score, href: `/admin/monitoring/ip/${encodeURIComponent(row.ip)}` }))} emptyLabel="Aucune IP." />
          <p className="mt-2 text-xs text-muted-foreground">Classées par score cumulé sur la période.</p>
        </section>
      </div>
    </>
  );
}
