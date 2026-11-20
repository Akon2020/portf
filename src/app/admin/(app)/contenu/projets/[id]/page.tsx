import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectForm } from "@/components/admin/forms/project-form";
import { PageHeader } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { deleteProjectAction, duplicateProjectAction, saveProjectAction } from "@/server/actions/content";
import { requireAdmin } from "@/server/auth/guards";
import { getProjectAdmin, listLibrary } from "@/server/content/admin-queries";

export const metadata: Metadata = { title: "Projet" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AdminProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enregistre?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { enregistre } = await searchParams;
  const isNew = id === "nouveau";
  if (!isNew && !UUID.test(id)) notFound();

  const [data, library] = await Promise.all([isNew ? null : getProjectAdmin(id), listLibrary()]);
  if (!isNew && !data) notFound();
  const project = data?.project;

  return (
    <>
      <PageHeader
        title={isNew ? "Nouveau projet" : tr(project!.title, "fr")}
        description={enregistre ? "Projet créé." : project?.reviewNote ? <span className="text-warning">À valider : {project.reviewNote}</span> : undefined}
        back={{ href: "/admin/contenu/projets", label: "Projets" }}
        actions={
          !isNew && (
            <>
              <ConfirmButton
                action={duplicateProjectAction.bind(null, id)}
                confirmText="Dupliquer ce projet en brouillon ?"
                label="Dupliquer"
                variant="neutral"
              />
              <ConfirmButton
                action={deleteProjectAction.bind(null, id)}
                confirmText="Archiver et retirer ce projet du site ? Il reste récupérable en base."
                label="Supprimer"
              />
            </>
          )
        }
      />
      <ProjectForm
        action={saveProjectAction.bind(null, isNew ? null : id)}
        project={project}
        galleryIds={data?.galleryIds}
        library={library}
      />
    </>
  );
}
