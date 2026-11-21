import { and, asc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { createInvoiceDraftAction } from "@/server/actions/crm";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { clientProjects, clients, milestones } from "@/server/db/schema";

export const metadata: Metadata = { title: "Nouvelle facture" };

const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined);

/** Confirmation step: creating a draft is a POST, never a side effect of opening a link. */
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string; projet?: string; jalon?: string; erreur?: string }> }) {
  await requireAdmin();
  const query = await searchParams;
  const clientId = uuid(query.client);
  const projectId = uuid(query.projet);
  const milestoneId = uuid(query.jalon);
  const db = getDb();
  const clientList = await db.select({ id: clients.id, name: clients.name }).from(clients).where(isNull(clients.deletedAt)).orderBy(asc(clients.name));
  const [project] = projectId ? await db.select().from(clientProjects).where(and(eq(clientProjects.id, projectId), isNull(clientProjects.deletedAt))).limit(1) : [];
  const [milestone] = milestoneId ? await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1) : [];

  return (
    <>
      <PageHeader title="Nouvelle facture" back={{ href: "/admin/facturation", label: "Facturation" }} />
      {clientList.length === 0 ? (
        <div className="admin-card max-w-lg space-y-3 p-6 text-sm">
          <p>Créez d&apos;abord la fiche du client à facturer.</p>
          <Link href="/admin/clients/nouveau" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 font-medium text-accent-foreground">
            Nouveau client
          </Link>
        </div>
      ) : (
        <form action={createInvoiceDraftAction} className="admin-card max-w-lg space-y-4 p-6">
          {project && <input type="hidden" name="clientProjectId" value={project.id} />}
          {milestone && <input type="hidden" name="milestoneId" value={milestone.id} />}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Client</span>
            <select name="clientId" defaultValue={project?.clientId ?? clientId ?? ""} required className="h-10 w-full rounded-lg border bg-card px-3 text-sm">
              <option value="" disabled>
                Choisir un client
              </option>
              {clientList.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          {query.erreur && <p className="text-sm text-destructive">Choisissez un client.</p>}
          <p className="text-sm text-muted-foreground">
            {milestone
              ? `Le brouillon reprendra le jalon « ${milestone.title} ».`
              : project
                ? `La facture sera rattachée au projet « ${project.name} ».`
                : "Un brouillon sera créé avec les coordonnées du client."}
          </p>
          <button type="submit" className="inline-flex h-10 items-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90">
            Créer le brouillon
          </button>
        </form>
      )}
    </>
  );
}
