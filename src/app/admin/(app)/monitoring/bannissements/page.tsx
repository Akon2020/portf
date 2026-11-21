import type { Metadata } from "next";
import Link from "next/link";
import { ResultButton } from "@/components/admin/crm-forms";
import { SecuritySettingsForm } from "@/components/admin/forms/business-settings-forms";
import { AllowForm, BanForm } from "@/components/admin/monitoring";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton, Badge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { saveSettingsAction } from "@/server/actions/content";
import { allowAction, allowMyIpAction, banAction, liftBanAction, removeAllowAction } from "@/server/actions/monitoring";
import { requireAdmin } from "@/server/auth/guards";
import { readSettingUncached } from "@/server/content/settings-store";
import { getRequestContext } from "@/server/request-context";
import { listAllowlist, listBans } from "@/server/services/monitoring";

export const metadata: Metadata = { title: "Bannissements" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const SCOPES = [
  { value: "active", label: "Actifs" },
  { value: "expired", label: "Expirés" },
  { value: "lifted", label: "Levés" },
] as const;

export default async function BansPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  await requireAdmin();
  const { vue } = await searchParams;
  const scope = SCOPES.find((item) => item.value === vue)?.value ?? "active";
  const [bans, allowlist, settings, context] = await Promise.all([listBans(scope), listAllowlist(), readSettingUncached("security"), getRequestContext()]);
  const sync = process.env.BAN_SYNC ?? "none";

  return (
    <>
      <PageHeader
        title="Bannissements"
        description={`Blocage applicatif (403) toujours actif. Synchronisation en amont : ${sync === "cloudflare" ? "Cloudflare" : sync === "htaccess" ? ".htaccess" : "aucune"}.`}
      />
      <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="admin-card p-5">
            <h2 className="mb-4 text-base font-semibold">Bannir une adresse</h2>
            <BanForm action={banAction} />
          </section>

          <section className="admin-card p-2">
            <nav aria-label="Filtrer" className="flex gap-1 p-2">
              {SCOPES.map((item) => (
                <Link
                  key={item.value}
                  href={item.value === "active" ? "/admin/monitoring/bannissements" : `/admin/monitoring/bannissements?vue=${item.value}`}
                  aria-current={scope === item.value ? "page" : undefined}
                  className={cn("inline-flex h-9 items-center rounded-lg px-3 text-sm", scope === item.value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-surface")}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[680px]">
                <thead>
                  <tr>
                    <th>Adresse</th>
                    <th>Motif</th>
                    <th>Depuis</th>
                    <th>Jusqu&apos;au</th>
                    <th>Requêtes bloquées</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted-foreground">
                        Aucun bannissement.
                      </td>
                    </tr>
                  ) : (
                    bans.map(({ ban, author }) => (
                      <tr key={ban.id}>
                        <td>
                          <Link href={`/admin/monitoring/ip/${encodeURIComponent(ban.ipOrCidr.split("/")[0])}`} className="font-mono text-xs hover:text-accent">
                            {ban.ipOrCidr}
                          </Link>
                          <span className="mt-1 block">
                            <Badge tone={ban.source === "auto" ? "warning" : "info"}>{ban.source === "auto" ? "Automatique" : `Manuel${author ? ` (${author})` : ""}`}</Badge>
                          </span>
                        </td>
                        <td className="max-w-[220px] text-xs">{ban.reason}</td>
                        <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(ban.bannedAt)}</td>
                        <td className="whitespace-nowrap text-xs">{ban.liftedAt ? `levé le ${dateTime.format(ban.liftedAt)}` : ban.expiresAt ? dateTime.format(ban.expiresAt) : "Permanent"}</td>
                        <td className="tabular-nums">{ban.hitCount}</td>
                        <td>{scope === "active" && <ActionButton action={liftBanAction.bind(null, ban.id)} label="Lever" />}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="admin-card p-5">
            <h2 className="text-base font-semibold">Liste blanche</h2>
            <p className="mt-1 text-sm text-muted-foreground">Jamais bannies, exclues de l&apos;audience. Votre adresse actuelle : <span className="font-mono">{context.ip}</span></p>
            <div className="mt-3">
              <ResultButton action={allowMyIpAction} label="Ajouter mon adresse" />
            </div>
            <div className="mt-4 border-t pt-4">
              <AllowForm action={allowAction} />
            </div>
            {allowlist.length > 0 && (
              <ul className="mt-4 divide-y border-t">
                {allowlist.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block font-mono text-xs">{entry.ipOrCidr}</span>
                      <span className="block truncate text-xs text-muted-foreground">{entry.label}</span>
                    </span>
                    <ActionButton action={removeAllowAction.bind(null, entry.id)} label="Retirer" />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="admin-card p-5">
            <h2 className="mb-4 text-base font-semibold">Réglages</h2>
            <SecuritySettingsForm action={saveSettingsAction.bind(null, "security")} value={settings} />
          </section>
        </div>
      </div>
    </>
  );
}
