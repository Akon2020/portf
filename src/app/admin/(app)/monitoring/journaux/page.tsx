import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/guards";
import { actionLabel } from "@/server/content/dashboard";
import { journal } from "@/server/services/monitoring";

export const metadata: Metadata = { title: "Journaux" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium", timeZone: "Africa/Lubumbashi" });
const KINDS = [
  { value: "connexions", label: "Connexions" },
  { value: "audit", label: "Audit" },
  { value: "envois", label: "Envois" },
  { value: "cron", label: "Tâches planifiées" },
  { value: "erreurs", label: "Erreurs" },
];

export default async function LogsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  await requireAdmin({ roles: ["super_admin"] });
  const { type } = await searchParams;
  const data = await journal(KINDS.some((kind) => kind.value === type) ? type! : "connexions");

  return (
    <>
      <PageHeader title="Journaux" description="Connexions, actions de l'administration, envois de documents, passages des tâches planifiées et erreurs serveur." />
      <nav aria-label="Type de journal" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="inline-flex gap-2">
          {KINDS.map((kind) => (
            <li key={kind.value}>
              <Link
                href={`/admin/monitoring/journaux?type=${kind.value}`}
                aria-current={data.kind === kind.value ? "page" : undefined}
                className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-full border px-3.5 text-sm", data.kind === kind.value ? "border-accent bg-accent text-accent-foreground" : "bg-card hover:bg-surface")}
              >
                {kind.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="admin-card overflow-x-auto p-2">
        {data.rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Rien à afficher.</p>
        ) : data.kind === "connexions" ? (
          <table className="admin-table min-w-[640px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>E-mail</th>
                <th>IP</th>
                <th>Résultat</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows as { id: string; createdAt: Date; email: string; ip: string | null; success: boolean; reason: string | null }[]).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(row.createdAt)}</td>
                  <td className="text-xs">{row.email}</td>
                  <td>
                    {row.ip ? (
                      <Link href={`/admin/monitoring/ip/${encodeURIComponent(row.ip)}`} className="font-mono text-xs hover:text-accent">
                        {row.ip}
                      </Link>
                    ) : null}
                  </td>
                  <td>
                    <Badge tone={row.success ? "success" : "danger"}>{row.success ? "Réussie" : "Échouée"}</Badge>
                    {row.reason && <span className="ml-2 font-mono text-[11px] text-muted-foreground">{row.reason}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data.kind === "audit" ? (
          <table className="admin-table min-w-[640px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Action</th>
                <th>Auteur</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows as { log: { id: string; createdAt: Date; action: string; entityType: string; ip: string | null }; actor: string | null }[]).map(({ log, actor }) => (
                <tr key={log.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(log.createdAt)}</td>
                  <td className="text-xs">
                    {actionLabel(log.action)}
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground">{log.entityType}</span>
                  </td>
                  <td className="text-xs">{actor ?? "Visiteur ou système"}</td>
                  <td className="font-mono text-xs">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data.kind === "envois" ? (
          <table className="admin-table min-w-[640px]">
            <thead>
              <tr>
                <th>Date</th>
                <th>Document</th>
                <th>Canal</th>
                <th>Destinataire</th>
                <th>Consulté</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows as { id: string; sentAt: Date; documentType: string; channel: string; recipient: string; openedAt: Date | null }[]).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(row.sentAt)}</td>
                  <td className="text-xs">{{ quote: "Devis", invoice: "Facture", receipt: "Reçu" }[row.documentType] ?? row.documentType}</td>
                  <td className="text-xs">{row.channel === "email" ? "E-mail" : "WhatsApp"}</td>
                  <td className="text-xs">{row.recipient}</td>
                  <td className="text-xs">{row.openedAt ? dateTime.format(row.openedAt) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : data.kind === "cron" ? (
          <table className="admin-table min-w-[640px]">
            <thead>
              <tr>
                <th>Début</th>
                <th>Tâche</th>
                <th>Statut</th>
                <th>Durée</th>
                <th>Traités</th>
              </tr>
            </thead>
            <tbody>
              {(data.rows as { id: string; task: string; startedAt: Date; finishedAt: Date | null; status: string; processed: number; error: string | null }[]).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{dateTime.format(row.startedAt)}</td>
                  <td className="font-mono text-xs">{row.task}</td>
                  <td>
                    <Badge tone={row.status === "success" ? "success" : row.status === "failed" ? "danger" : "info"}>{{ success: "Réussie", failed: "Échec", running: "En cours" }[row.status] ?? row.status}</Badge>
                    {row.error && <span className="mt-1 block max-w-[320px] truncate font-mono text-[11px] text-destructive">{row.error}</span>}
                  </td>
                  <td className="text-xs tabular-nums">{row.finishedAt ? `${((row.finishedAt.getTime() - row.startedAt.getTime()) / 1000).toFixed(1)} s` : ""}</td>
                  <td className="tabular-nums">{row.processed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="divide-y">
            {(data.rows as { id: string; createdAt: Date; message: string; stack: string | null; method: string | null; path: string | null; digest: string | null }[]).map((row) => (
              <li key={row.id} className="p-3">
                <p className="text-xs text-muted-foreground">
                  {dateTime.format(row.createdAt)} · <span className="font-mono">{row.method} {row.path}</span>
                  {row.digest && <span className="font-mono"> · {row.digest}</span>}
                </p>
                <p className="mt-1 text-sm font-medium">{row.message}</p>
                {row.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground">Pile d&apos;appels</summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-surface p-3 text-[11px]">{row.stack}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
