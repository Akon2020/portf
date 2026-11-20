import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState, NewButton, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { requireAdmin } from "@/server/auth/guards";
import { ADMIN_LISTS } from "@/server/content/admin-queries";
import { ENTITY_VIEWS, isEntityRoute } from "./config";

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  return { title: isEntityRoute(entity) ? ENTITY_VIEWS[entity].title : "Contenu" };
}

export default async function EntityListPage({ params }: { params: Promise<{ entity: string }> }) {
  await requireAdmin();
  const { entity } = await params;
  if (!isEntityRoute(entity)) notFound();
  const view = ENTITY_VIEWS[entity];
  const rows = (await ADMIN_LISTS[entity]()) as unknown as (Record<string, unknown> & { id: string })[];

  return (
    <>
      <PageHeader
        title={view.title}
        description={view.description}
        back={{ href: "/admin/contenu", label: "Contenu" }}
        actions={<NewButton href={`/admin/contenu/${entity}/nouveau`} label="Ajouter" />}
      />
      {rows.length === 0 ? (
        <EmptyState>Aucun élément pour le moment.</EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={`/admin/contenu/${entity}/${row.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-surface/40 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{view.primary(row)}</span>
                  {view.secondary(row) && <span className="block truncate text-sm text-muted-foreground">{view.secondary(row)}</span>}
                </span>
                <span className="flex shrink-0 flex-wrap gap-1.5">
                  {view.badges(row).map((badge) => (
                    <Badge key={badge.label} tone={badge.tone}>
                      {badge.label}
                    </Badge>
                  ))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
