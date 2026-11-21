import { notFound } from "next/navigation";
import {
  FaqForm,
  JourneyForm,
  PartnerForm,
  ServiceForm,
  SkillForm,
  SocialForm,
  StatForm,
  TestimonialForm,
} from "@/components/admin/forms/entity-forms";
import { PageHeader } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { deleteEntityAction, saveEntityAction } from "@/server/actions/content";
import { requireAdmin } from "@/server/auth/guards";
import { getEntityAdmin, listLibrary, listProjectsAdmin } from "@/server/content/admin-queries";
import type { Faq, JourneyItem, Partner, Service, Skill, SocialLink, Stat, Testimonial } from "@/server/db/schema";
import { ENTITY_VIEWS, isEntityRoute } from "../config";

const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params;
  return { title: isEntityRoute(entity) ? ENTITY_VIEWS[entity].singular : "Contenu" };
}

export default async function EntityEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string; id: string }>;
  searchParams: Promise<{ enregistre?: string }>;
}) {
  await requireAdmin();
  const { entity, id } = await params;
  const { enregistre } = await searchParams;
  if (!isEntityRoute(entity)) notFound();
  const isNew = id === "nouveau";
  if (!isNew && !UUID.test(id)) notFound();

  const row = isNew ? null : await getEntityAdmin(entity, id);
  if (!isNew && !row) notFound();

  const view = ENTITY_VIEWS[entity];
  const action = saveEntityAction.bind(null, entity, isNew ? null : id);
  const note = (row as { reviewNote?: string | null } | null)?.reviewNote;

  let form: React.ReactNode;
  switch (entity) {
    case "parcours":
      form = <JourneyForm action={action} row={row as JourneyItem | null} />;
      break;
    case "competences":
      form = <SkillForm action={action} row={row as Skill | null} />;
      break;
    case "services":
      form = <ServiceForm action={action} row={row as Service | null} />;
      break;
    case "temoignages": {
      const [library, projects] = await Promise.all([listLibrary(), listProjectsAdmin()]);
      form = (
        <TestimonialForm
          action={action}
          row={row as Testimonial | null}
          library={library}
          projects={projects.map((project) => ({ value: project.id, label: tr(project.title, "fr") }))}
        />
      );
      break;
    }
    case "chiffres":
      form = <StatForm action={action} row={row as Stat | null} />;
      break;
    case "reseaux":
      form = <SocialForm action={action} row={row as SocialLink | null} />;
      break;
    case "faq":
      form = <FaqForm action={action} row={row as Faq | null} />;
      break;
    case "partenaires":
      form = <PartnerForm action={action} row={row as Partner | null} library={await listLibrary()} />;
      break;
  }

  return (
    <>
      <PageHeader
        title={isNew ? `${view.singular} : ajout` : view.primary(row as never)}
        description={enregistre ? "Élément créé." : note ? <span className="text-warning">À valider : {note}</span> : undefined}
        back={{ href: `/admin/contenu/${entity}`, label: view.title }}
        actions={
          !isNew && (
            <ConfirmButton action={deleteEntityAction.bind(null, entity, id)} confirmText="Supprimer cet élément ?" label="Supprimer" />
          )
        }
      />
      {form}
    </>
  );
}
