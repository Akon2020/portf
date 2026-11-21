import { isIP } from "node:net";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResultButton } from "@/components/admin/crm-forms";
import { BarList } from "@/components/admin/monitoring";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton, Badge } from "@/components/admin/ui";
import { liftBanAction, quickAllowAction, quickBanAction } from "@/server/actions/monitoring";
import { requireAdmin } from "@/server/auth/guards";
import { ipDetail } from "@/server/services/monitoring";
import { ACTION_TAKEN, CATEGORY_LABELS, SEVERITY } from "../../labels";

export const metadata: Metadata = { title: "Adresse IP" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Africa/Lubumbashi" });
const countryName = new Intl.DisplayNames(["fr"], { type: "region" });

export default async function IpPage({ params }: { params: Promise<{ ip: string }> }) {
  await requireAdmin();
  const ip = decodeURIComponent((await params).ip).toLowerCase();
  if (!isIP(ip)) notFound();
  const detail = await ipDetail(ip);
  const activeBan = detail.bans.find((ban) => !ban.liftedAt && (!ban.expiresAt || ban.expiresAt > new Date()));

  return (
    <>
      <PageHeader
        title={ip}
        back={{ href: "/admin/monitoring/securite", label: "Sécurité" }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {detail.allowed ? <Badge tone="success">Liste blanche</Badge> : activeBan ? <Badge tone="danger">Bannie</Badge> : <Badge>Non bannie</Badge>}
            {detail.countries.map((code) => {
              let label = code;
              try {
                label = countryName.of(code) ?? code;
              } catch {
                label = code;
              }
              return <span key={code}>{label}</span>;
            })}
          </span>
        }
        actions={
          !detail.allowed && (
            <>
              {activeBan ? (
                <ActionButton action={liftBanAction.bind(null, activeBan.id)} label="Lever le bannissement" className="h-10 px-3.5 text-sm" />
              ) : (
                <>
                  <ResultButton action={quickBanAction.bind(null, ip, 24)} label="Bannir 24 h" tone="danger" confirmText={`Bannir ${ip} pendant 24 heures ?`} />
                  <ResultButton action={quickBanAction.bind(null, ip, null)} label="Bannir définitivement" tone="danger" confirmText={`Bannir ${ip} définitivement ?`} />
                </>
              )}
              <ResultButton action={quickAllowAction.bind(null, ip)} label="Autoriser" confirmText={`Ajouter ${ip} à la liste blanche ? Elle ne sera plus jamais bannie.`} />
            </>
          )
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Score de réputation</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{detail.reputation?.score ?? 0}</p>
          <p className="text-xs text-muted-foreground">Divisé par deux toutes les 24 h sans activité</p>
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Événements</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{detail.reputation?.eventsCount ?? detail.events.length}</p>
          {detail.reputation && <p className="text-xs text-muted-foreground">Depuis le {dateTime.format(detail.reputation.firstSeenAt)}</p>}
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Bannissements</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{detail.bans.length}</p>
          {activeBan && <p className="text-xs text-destructive">{activeBan.expiresAt ? `jusqu'au ${dateTime.format(activeBan.expiresAt)}` : "permanent"}</p>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 *:min-w-0 lg:grid-cols-2">
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Méthodes tentées</h2>
          <BarList rows={detail.methods.map((row) => ({ label: `${CATEGORY_LABELS[row.category] ?? row.category} (${row.ruleId})`, value: row.count }))} />
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">User-agents</h2>
          {detail.agents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun.</p>
          ) : (
            <ul className="space-y-2">
              {detail.agents.map((agent) => (
                <li key={agent} className="break-all font-mono text-xs">
                  {agent}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-card mt-6 overflow-x-auto p-2">
        <table className="admin-table min-w-[720px]">
          <thead>
            <tr>
              <th>Date</th>
              <th>Méthode tentée</th>
              <th>Requête et extrait</th>
              <th>Gravité</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {detail.events.map((event) => {
              const [label, tone] = SEVERITY[event.severity];
              return (
                <tr key={event.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(event.createdAt)}</td>
                  <td className="text-xs">{CATEGORY_LABELS[event.category]}</td>
                  <td className="max-w-[360px]">
                    <span className="block break-all font-mono text-xs">
                      {event.method} {event.path}
                      {event.query}
                    </span>
                    {event.payloadExcerpt && <span className="block break-all font-mono text-[11px] text-muted-foreground">{event.payloadExcerpt}</span>}
                  </td>
                  <td>
                    <Badge tone={tone}>{label}</Badge>
                  </td>
                  <td className="text-xs">{ACTION_TAKEN[event.actionTaken]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
