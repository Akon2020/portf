import type { Metadata } from "next";
import Link from "next/link";
import { BarList } from "@/components/admin/monitoring";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/guards";
import { audienceOverview } from "@/server/services/monitoring";

export const metadata: Metadata = { title: "Audience" };

const EVENT_LABELS: Record<string, string> = {
  cta_click: "Clics sur un appel à l'action",
  contact_submit: "Messages envoyés",
  quote_submit: "Demandes de devis",
  cv_download: "Téléchargements du CV",
  outbound_click: "Liens externes",
  whatsapp_click: "Clics WhatsApp",
  calendly_click: "Clics Calendly",
  share_click: "Partages",
  engaged_time: "Lectures de plus de 3 s",
};

const DEVICES: Record<string, string> = { mobile: "Téléphone", desktop: "Ordinateur", tablet: "Tablette", "?": "Inconnu" };
const countryName = new Intl.DisplayNames(["fr"], { type: "region" });

function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-muted-foreground">période précédente : 0</span>;
  const change = Math.round(((now - before) / before) * 100);
  return <span className={cn("text-xs font-medium", change >= 0 ? "text-success" : "text-destructive")}>{change >= 0 ? `+${change}` : change} % vs période précédente</span>;
}

export default async function AudiencePage({ searchParams }: { searchParams: Promise<{ jours?: string }> }) {
  await requireAdmin();
  const { jours } = await searchParams;
  const days = [7, 30, 90].includes(Number(jours)) ? Number(jours) : 30;
  const data = await audienceOverview(days);
  const maxDaily = Math.max(1, ...data.daily.map((row) => row.views));

  return (
    <>
      <PageHeader
        title="Audience"
        description="Mesurée côté serveur, sans cookie ni IP stockée. Les robots et vos adresses autorisées sont exclus."
        actions={
          <nav aria-label="Période" className="inline-flex rounded-xl border bg-card p-1">
            {[7, 30, 90].map((value) => (
              <Link
                key={value}
                href={`/admin/monitoring?jours=${value}`}
                aria-current={days === value ? "page" : undefined}
                className={cn("inline-flex h-8 items-center rounded-lg px-3 text-sm", days === value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {value} j
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Pages vues</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{data.totals.views.toLocaleString("fr-FR")}</p>
          <Trend now={data.totals.views} before={data.totals.prev_views} />
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Visiteurs uniques (par jour)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{data.totals.visitors.toLocaleString("fr-FR")}</p>
          <Trend now={data.totals.visitors} before={data.totals.prev_visitors} />
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">En ce moment (30 min)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{data.realtime.visitors}</p>
          <span className="text-xs text-muted-foreground">{data.realtime.views} pages vues</span>
        </div>
        <div className="admin-card p-5">
          <p className="text-sm text-muted-foreground">Conversions</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{data.funnel.quote_submit + data.funnel.contact_submit}</p>
          <span className="text-xs text-muted-foreground">
            {data.funnel.quote_submit} devis · {data.funnel.contact_submit} messages
          </span>
        </div>
      </div>

      <section className="admin-card mt-6 p-5">
        <h2 className="text-base font-semibold">Visites par jour</h2>
        {data.daily.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Aucune visite enregistrée sur la période.</p>
        ) : (
          <>
            <div aria-hidden="true" className="mt-5 flex h-40 items-end gap-[3px]">
              {data.daily.map((row) => (
                <div key={row.day} className="flex h-full flex-1 flex-col justify-end" title={`${row.day} : ${row.views} vues, ${row.visitors} visiteurs`}>
                  <div className="rounded-t-sm bg-accent/85" style={{ height: `${Math.max(2, (row.views / maxDaily) * 100)}%` }} />
                </div>
              ))}
            </div>
            <table className="sr-only">
              <caption>Visites par jour</caption>
              <tbody>
                {data.daily.map((row) => (
                  <tr key={row.day}>
                    <th scope="row">{row.day}</th>
                    <td>{row.views} vues</td>
                    <td>{row.visitors} visiteurs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <div className="mt-6 grid gap-6 *:min-w-0 lg:grid-cols-2">
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Pages populaires</h2>
          <BarList rows={data.pages.map((row) => ({ label: row.path, value: row.views }))} />
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Sources</h2>
          <BarList rows={data.sources.map((row) => ({ label: row.source, value: row.views }))} />
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Pays</h2>
          <BarList
            rows={data.countries.map((row) => {
              let label = row.country === "?" ? "Inconnu (sans Cloudflare)" : row.country;
              try {
                if (row.country !== "?") label = countryName.of(row.country) ?? row.country;
              } catch {
                label = row.country;
              }
              return { label, value: row.views };
            })}
          />
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Appareils</h2>
          <BarList rows={data.devices.map((row) => ({ label: DEVICES[row.device] ?? row.device, value: row.views }))} />
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Entonnoir (visiteurs)</h2>
          <BarList
            rows={[
              { label: "Ont consulté un projet", value: data.funnel.project_views },
              { label: "Ont ouvert la page devis", value: data.funnel.quote_page },
              { label: "Ont envoyé une demande de devis", value: data.funnel.quote_submit },
            ]}
          />
        </section>
        <section className="admin-card p-5">
          <h2 className="mb-3 text-base font-semibold">Événements</h2>
          <BarList rows={data.events.map((row) => ({ label: EVENT_LABELS[row.name] ?? row.name, value: row.count }))} />
        </section>
      </div>
    </>
  );
}
