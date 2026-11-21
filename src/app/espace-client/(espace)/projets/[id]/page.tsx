import { ArrowLeft, CheckCircle2, Circle, ExternalLink, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalMessageForm } from "@/components/portal/portal-forms";
import { formatMoney } from "@/lib/money";
import { portalMessageAction } from "@/server/actions/portal";
import { getClientProjectDetail } from "@/server/services/clients";
import { engagementSummary } from "@/server/services/invoices";
import { requirePortal } from "@/server/services/portal";

export const metadata: Metadata = { title: "Projet" };

const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

export default async function PortalProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { clientId } = await requirePortal();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Filtered on the session client and on what is visible to the client.
  const detail = await getClientProjectDetail(id, { clientId, visibleOnly: true });
  if (!detail) notFound();
  const { project } = detail;
  const firstInvoice = detail.invoices[0];
  const engagement = firstInvoice ? await engagementSummary(firstInvoice) : null;

  return (
    <div className="space-y-6">
      <Link href="/espace-client" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Retour
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
        {project.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{project.description}</p>}
      </div>

      <section className="admin-card p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Avancement</h2>
          <span className="text-2xl font-semibold tabular-nums">{detail.progress} %</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={detail.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement du projet">
          <div className="h-full rounded-full bg-accent" style={{ width: `${detail.progress}%` }} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {project.startDate && (
            <div>
              <dt className="text-muted-foreground">Début</dt>
              <dd>{day(project.startDate)}</dd>
            </div>
          )}
          {project.dueDate && (
            <div>
              <dt className="text-muted-foreground">Échéance prévue</dt>
              <dd>{day(project.dueDate)}</dd>
            </div>
          )}
          {project.budget !== null && (
            <div>
              <dt className="text-muted-foreground">Budget</dt>
              <dd>{formatMoney(project.budget, project.currency)}</dd>
            </div>
          )}
        </dl>
        {(project.stagingUrl || project.productionUrl) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {project.stagingUrl && (
              <a href={project.stagingUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm hover:bg-surface">
                <ExternalLink className="size-3.5" aria-hidden="true" /> Version de test
              </a>
            )}
            {project.productionUrl && (
              <a href={project.productionUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm hover:bg-surface">
                <ExternalLink className="size-3.5" aria-hidden="true" /> Version en ligne
              </a>
            )}
          </div>
        )}
      </section>

      {engagement && (
        <section className="admin-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Paiements</h2>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-label="Part réglée" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((engagement.paid / Math.max(1, engagement.total)) * 100)}>
            <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, (engagement.paid / Math.max(1, engagement.total)) * 100)}%` }} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Montant total</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatMoney(engagement.total, engagement.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Déjà réglé</dt>
              <dd className="text-lg font-semibold tabular-nums text-success">{formatMoney(engagement.paid, engagement.currency)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Reste à payer</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatMoney(engagement.remaining, engagement.currency)}</dd>
            </div>
          </dl>
        </section>
      )}

      <div className="grid gap-6 *:min-w-0 lg:grid-cols-2">
        <section className="admin-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Étapes</h2>
          {detail.milestones.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Les étapes seront ajoutées prochainement.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {detail.milestones.map((milestone) => (
                <li key={milestone.id} className="flex gap-3">
                  {milestone.status === "done" ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Terminé" />
                  ) : (
                    <Circle className={`mt-0.5 size-5 shrink-0 ${milestone.status === "in_progress" ? "text-accent" : "text-muted-foreground"}`} aria-label={milestone.status === "in_progress" ? "En cours" : "À venir"} />
                  )}
                  <span>
                    <span className={`block text-sm font-medium ${milestone.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>{milestone.title}</span>
                    {milestone.dueDate && <span className="block text-xs text-muted-foreground">Prévu le {day(milestone.dueDate)}</span>}
                    {milestone.description && <span className="mt-0.5 block text-xs text-muted-foreground">{milestone.description}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="admin-card p-5 sm:p-6">
          <h2 className="text-base font-semibold">Fichiers</h2>
          {detail.files.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucun fichier partagé pour le moment.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {detail.files.map((file) => (
                <li key={file.id} className="py-2.5">
                  <a href={`/espace-client/fichiers/${file.id}`} className="flex items-center gap-2 text-sm font-medium hover:text-accent">
                    <FileText className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{file.file.name}</span>
                  </a>
                  {file.note && <p className="ml-6 text-xs text-muted-foreground">{file.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="admin-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Journal du projet</h2>
        {detail.updates.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Les nouvelles du projet apparaîtront ici.</p>
        ) : (
          <ol className="mt-4 space-y-4 border-l pl-4">
            {detail.updates.map((update) => (
              <li key={update.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" />
                <p className="text-xs text-muted-foreground">{dateTime.format(update.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line text-sm">{update.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="admin-card p-5 sm:p-6">
        <h2 className="text-base font-semibold">Une question sur ce projet ?</h2>
        <div className="mt-4">
          <PortalMessageForm action={portalMessageAction.bind(null, project.id)} />
        </div>
      </section>
    </div>
  );
}
