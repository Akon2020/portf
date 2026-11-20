import { AlertTriangle, ExternalLink, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/components/admin/labels";
import { EmptyState, NewButton, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { requireAdmin } from "@/server/auth/guards";
import { listProjectsAdmin } from "@/server/content/admin-queries";

export const metadata: Metadata = { title: "Projets" };

export default async function AdminProjectsPage() {
  await requireAdmin();
  const projects = await listProjectsAdmin();
  return (
    <>
      <PageHeader
        title="Projets"
        description={`${projects.length} projets, ${projects.filter((p) => p.status === "published").length} publiés`}
        back={{ href: "/admin/contenu", label: "Contenu" }}
        actions={<NewButton href="/admin/contenu/projets/nouveau" label="Nouveau projet" />}
      />
      {projects.length === 0 ? (
        <EmptyState>Aucun projet pour le moment.</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-surface/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Projet</th>
                <th className="px-4 py-3 font-medium">Catégories</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Ordre</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-surface/40">
                  <td className="px-4 py-3">
                    <Link href={`/admin/contenu/projets/${project.id}`} className="font-medium hover:text-accent">
                      {tr(project.title, "fr")}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {project.isFeatured && (
                        <Badge tone="info">
                          <Star className="mr-1 size-3" aria-hidden="true" />À la une
                        </Badge>
                      )}
                      {project.needsReview && (
                        <Badge tone="warning">
                          <AlertTriangle className="mr-1 size-3" aria-hidden="true" />À valider
                        </Badge>
                      )}
                      {project.confidential && <Badge>Confidentiel</Badge>}
                      {project.status === "published" && (
                        <a href={`/projets/${project.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          Voir <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{project.categories.map((c) => CATEGORY_LABELS[c]).join(", ")}</td>
                  <td className="px-4 py-3">
                    <Badge tone={project.status === "published" ? "success" : project.status === "archived" ? "neutral" : "warning"}>
                      {STATUS_LABELS[project.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{project.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
