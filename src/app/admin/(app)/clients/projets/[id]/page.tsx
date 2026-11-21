import { ExternalLink, FileText, Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientProjectForm, MilestoneForm, ProjectFilesForm, ProjectUpdateForm } from "@/components/admin/crm-forms";
import { PageHeader } from "@/components/admin/page-header";
import { ActionButton, Badge, ConfirmButton } from "@/components/admin/ui";
import { formatMoney } from "@/lib/money";
import {
  addProjectUpdateAction,
  deleteClientProjectAction,
  deleteMilestoneAction,
  deleteProjectFileAction,
  deleteProjectUpdateAction,
  publishCaseStudyAction,
  saveClientProjectAction,
  saveMilestoneAction,
  toggleProjectFileAction,
  uploadProjectFilesAction,
} from "@/server/actions/crm";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { clients } from "@/server/db/schema";
import { getClientProjectDetail } from "@/server/services/clients";
import { and, eq, isNull } from "drizzle-orm";
import { INVOICE_STATUS, MILESTONE_STATUS, PROJECT_STATUS } from "../../labels";

export const metadata: Metadata = { title: "Projet client" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });
const day = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="admin-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function ClientProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ client?: string; accord?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { client: clientParam, accord } = await searchParams;

  if (id === "nouveau") {
    if (!clientParam || !/^[0-9a-f-]{36}$/i.test(clientParam)) notFound();
    const [client] = await getDb().select().from(clients).where(and(eq(clients.id, clientParam), isNull(clients.deletedAt))).limit(1);
    if (!client) notFound();
    return (
      <>
        <PageHeader title="Nouveau projet" description={client.name} back={{ href: `/admin/clients/${client.id}`, label: client.name }} />
        <ClientProjectForm action={saveClientProjectAction.bind(null, null, client.id)} />
      </>
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getClientProjectDetail(id);
  if (!detail) notFound();
  const { project, client } = detail;
  const [statusLabel, statusTone] = PROJECT_STATUS[project.status];

  return (
    <>
      <PageHeader
        title={project.name}
        back={{ href: `/admin/clients/${client.id}`, label: client.name }}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            {project.visibleToClient ? <Badge tone="success">Visible par le client</Badge> : <Badge>Masqué au client</Badge>}
            {project.budget !== null && <span>Budget {formatMoney(project.budget, project.currency)}</span>}
          </span>
        }
        actions={
          <>
            <Link href={`/admin/facturation/nouveau?client=${client.id}&projet=${project.id}`} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90">
              <Receipt className="size-4" aria-hidden="true" /> Facturer
            </Link>
            <ConfirmButton action={deleteClientProjectAction.bind(null, project.id)} confirmText="Supprimer ce projet ? Il sera archivé." label="Supprimer" />
          </>
        }
      />

      <div className="grid gap-6 *:min-w-0 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel title={`Avancement : ${detail.progress} %`} description={project.progress === null ? "Calculé à partir des jalons terminés." : "Saisi manuellement dans la fiche du projet."}>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuenow={detail.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Avancement du projet">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${detail.progress}%` }} />
            </div>
          </Panel>

          <Panel title="Jalons" description="Étapes du projet, facturables une par une si un montant est saisi.">
            <ul className="space-y-3">
              {detail.milestones.map((milestone) => {
                const [label, tone] = MILESTONE_STATUS[milestone.status];
                return (
                  <li key={milestone.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{milestone.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {[milestone.dueDate && `Échéance ${day(milestone.dueDate)}`, milestone.amount !== null && formatMoney(milestone.amount, project.currency), !milestone.visibleToClient && "masqué au client"]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={tone}>{label}</Badge>
                        {milestone.amount !== null && milestone.amount > 0 && (
                          <Link
                            href={`/admin/facturation/nouveau?client=${client.id}&projet=${project.id}&jalon=${milestone.id}`}
                            className="inline-flex h-8 items-center rounded-lg border bg-card px-2.5 text-xs hover:bg-surface"
                          >
                            Facturer ce jalon
                          </Link>
                        )}
                      </div>
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Modifier</summary>
                      <div className="mt-3 space-y-3">
                        <MilestoneForm action={saveMilestoneAction.bind(null, project.id, milestone.id)} milestone={milestone} />
                        <ConfirmButton action={deleteMilestoneAction.bind(null, project.id, milestone.id)} confirmText="Supprimer ce jalon ?" label="Supprimer le jalon" />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
            <details className="mt-4 rounded-xl border border-dashed p-4" open={detail.milestones.length === 0}>
              <summary className="cursor-pointer text-sm font-medium">Ajouter un jalon</summary>
              <div className="mt-3">
                <MilestoneForm action={saveMilestoneAction.bind(null, project.id, null)} />
              </div>
            </details>
          </Panel>

          <Panel title="Journal d'avancement" description="Les notes visibles apparaissent dans l'espace du client.">
            <ProjectUpdateForm action={addProjectUpdateAction.bind(null, project.id)} />
            <ol className="mt-5 space-y-4 border-l pl-4">
              {detail.updates.map((update) => (
                <li key={update.id} className="relative">
                  <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-accent" />
                  <p className="text-xs text-muted-foreground">
                    {dateTime.format(update.createdAt)}
                    {!update.visibleToClient && " · interne"}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm">{update.body}</p>
                  <ActionButton action={deleteProjectUpdateAction.bind(null, project.id, update.id)} label="Retirer" className="mt-2 h-7" />
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Fichiers partagés">
            <ProjectFilesForm action={uploadProjectFilesAction.bind(null, project.id)} />
            {detail.files.length > 0 && (
              <ul className="mt-5 divide-y">
                {detail.files.map((file) => (
                  <li key={file.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      <a href={`/api/admin/projets/fichiers/${file.id}`} className="flex items-center gap-2 font-medium hover:text-accent">
                        <FileText className="size-4 shrink-0" aria-hidden="true" />
                        <span className="truncate">{file.file.name}</span>
                      </a>
                      <span className="block text-xs text-muted-foreground">
                        {[`${Math.ceil(file.file.size / 1024)} Ko`, file.note, dateTime.format(file.createdAt)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap gap-2">
                      <ActionButton action={toggleProjectFileAction.bind(null, project.id, file.id, !file.visibleToClient)} label={file.visibleToClient ? "Masquer au client" : "Montrer au client"} />
                      <ConfirmButton action={deleteProjectFileAction.bind(null, project.id, file.id)} confirmText="Supprimer ce fichier ?" label="Supprimer" />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <details className="admin-card p-5">
            <summary className="cursor-pointer text-base font-semibold">Modifier le projet</summary>
            <div className="mt-5">
              <ClientProjectForm action={saveClientProjectAction.bind(null, project.id, client.id)} project={project} />
            </div>
          </details>
        </div>

        <div className="space-y-6">
          <Panel title="Factures du projet">
            {detail.invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune facture.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {detail.invoices.map((invoice) => {
                  const [label, tone] = INVOICE_STATUS[invoice.status];
                  return (
                    <li key={invoice.id} className="flex items-center justify-between gap-2">
                      <Link href={`/admin/facturation/${invoice.id}`} className="min-w-0 hover:text-accent">
                        <span className="block font-mono text-xs">{invoice.number ?? "Brouillon"}</span>
                        <span className="block tabular-nums">{formatMoney(invoice.total, invoice.currency)}</span>
                      </Link>
                      <Badge tone={tone}>{label}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          {(project.repoUrl || project.stagingUrl || project.productionUrl) && (
            <Panel title="Liens">
              <ul className="space-y-2 text-sm">
                {[
                  ["Code", project.repoUrl],
                  ["Préproduction", project.stagingUrl],
                  ["Production", project.productionUrl],
                ]
                  .filter(([, url]) => url)
                  .map(([label, url]) => (
                    <li key={label}>
                      <a href={url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-accent">
                        <ExternalLink className="size-3.5" aria-hidden="true" /> {label}
                      </a>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}

          <Panel title="Étude de cas" description="Crée un projet public en brouillon, confidentiel par défaut.">
            {project.portfolioProjectId ? (
              <Link href={`/admin/contenu/projets/${project.portfolioProjectId}`} className="text-sm font-medium text-accent hover:underline">
                Ouvrir l&apos;étude de cas
              </Link>
            ) : (
              <form action={publishCaseStudyAction.bind(null, project.id)} className="space-y-3">
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="consent" value="1" required className="mt-0.5 size-4 accent-[var(--accent)]" />
                  Le client a donné son accord pour présenter ce projet.
                </label>
                {accord && <p className="text-sm text-destructive">Cochez l&apos;accord du client pour continuer.</p>}
                <button type="submit" className="inline-flex h-9 items-center rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface">
                  Publier en étude de cas
                </button>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
