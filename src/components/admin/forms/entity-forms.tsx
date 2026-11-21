"use client";

import type { FormState } from "@/server/actions/content";
import type { Faq, JourneyItem, Partner, Service, Skill, SocialLink, Stat, Testimonial } from "@/server/db/schema";
import { EntityForm } from "../entity-form";
import { CheckboxField, LocalizedField, LocalizedListField, SelectField, TextAreaField, TextField } from "../fields";
import {
  CURRENCY_OPTIONS,
  JOURNEY_TYPE_OPTIONS,
  PLATFORM_OPTIONS,
  SKILL_GROUP_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  STATUS_OPTIONS,
  TESTIMONIAL_STATUS_OPTIONS,
} from "../labels";
import { MediaPicker, type LibraryItem } from "../media-picker";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

const grid = "grid gap-4 sm:grid-cols-2";

export function JourneyForm({ action, row }: { action: Action; row?: JourneyItem | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField name="status" label="Statut" options={STATUS_OPTIONS} defaultValue={row?.status ?? "draft"} errors={errors} />
            <SelectField name="type" label="Type" options={JOURNEY_TYPE_OPTIONS} defaultValue={row?.type} errors={errors} />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} hint="Plus petit en premier" />
          </div>
          <div className={grid}>
            <TextField name="organization" label="Organisation" required defaultValue={row?.organization} errors={errors} />
            <TextField name="location" label="Lieu" defaultValue={row?.location} errors={errors} />
            <TextField name="startDate" label="Début" type="date" required defaultValue={row?.startDate} errors={errors} />
            <TextField name="endDate" label="Fin" type="date" defaultValue={row?.endDate} errors={errors} hint="Vide = « aujourd'hui »" />
            <TextField name="url" label="Lien" type="url" defaultValue={row?.url} errors={errors} />
          </div>
          <LocalizedField name="title" label="Intitulé" required defaultValue={row?.title} errors={errors} />
          <LocalizedField name="description" label="Description" multiline defaultValue={row?.description} errors={errors} />
          <LocalizedListField name="highlights" label="Points forts" itemLabel="Point" defaultValue={row?.highlights} />
          <CheckboxField name="needsReview" label="À valider" defaultChecked={row?.needsReview} />
          <TextAreaField name="reviewNote" label="Note de validation (interne)" rows={2} defaultValue={row?.reviewNote} errors={errors} />
        </>
      )}
    </EntityForm>
  );
}

export function SkillForm({ action, row }: { action: Action; row?: Skill | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className={grid}>
            <TextField name="name" label="Nom" required defaultValue={row?.name} errors={errors} />
            <TextField name="iconSlug" label="Icône (facultatif)" defaultValue={row?.iconSlug} errors={errors} />
            <SelectField name="group" label="Domaine" options={SKILL_GROUP_OPTIONS} defaultValue={row?.group} errors={errors} />
            <SelectField name="level" label="Niveau" options={SKILL_LEVEL_OPTIONS} defaultValue={row?.level} errors={errors} />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
          </div>
          <CheckboxField name="isVisible" label="Visible sur le site" defaultChecked={row?.isVisible ?? true} />
        </>
      )}
    </EntityForm>
  );
}

export function ServiceForm({ action, row }: { action: Action; row?: Service | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="slug" label="Slug" required defaultValue={row?.slug} errors={errors} />
            <TextField name="icon" label="Icône" defaultValue={row?.icon} errors={errors} hint="code, smartphone, sparkles, shield-check, graduation-cap" />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
          </div>
          <LocalizedField name="title" label="Titre" required defaultValue={row?.title} errors={errors} />
          <LocalizedField name="description" label="Description" multiline defaultValue={row?.description} errors={errors} />
          <LocalizedListField name="deliverables" label="Livrables" itemLabel="Livrable" defaultValue={row?.deliverables} />
          <div className={grid}>
            <TextField
              name="startingPrice"
              label="Prix de départ (facultatif)"
              inputMode="decimal"
              defaultValue={row?.startingPrice != null ? String(row.startingPrice / 100) : ""}
              errors={errors}
              hint="Laisser vide pour ne pas afficher de prix"
            />
            <SelectField name="currency" label="Devise" options={CURRENCY_OPTIONS} defaultValue={row?.currency ?? "USD"} errors={errors} />
          </div>
          <CheckboxField name="isVisible" label="Visible sur le site" defaultChecked={row?.isVisible ?? true} />
        </>
      )}
    </EntityForm>
  );
}

export function TestimonialForm({
  action,
  row,
  library,
  projects,
}: {
  action: Action;
  row?: Testimonial | null;
  library: LibraryItem[];
  projects: { value: string; label: string }[];
}) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField name="status" label="Statut" options={TESTIMONIAL_STATUS_OPTIONS} defaultValue={row?.status ?? "pending"} errors={errors} hint="Seuls les témoignages approuvés sont publiés" />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
            <SelectField name="projectId" label="Projet lié" options={[{ value: "", label: "Aucun" }, ...projects]} defaultValue={row?.projectId ?? ""} errors={errors} />
          </div>
          <div className={grid}>
            <TextField name="authorName" label="Nom de l'auteur" required defaultValue={row?.authorName} errors={errors} />
            <TextField name="authorCompany" label="Organisation" defaultValue={row?.authorCompany} errors={errors} />
            <TextField name="authorUrl" label="Lien (LinkedIn...)" type="url" defaultValue={row?.authorUrl} errors={errors} />
          </div>
          <LocalizedField name="authorRole" label="Rôle de l'auteur" defaultValue={row?.authorRole} errors={errors} />
          <LocalizedField name="quote" label="Citation" required multiline defaultValue={row?.quote} errors={errors} />
          <MediaPicker name="authorPhotoId" label="Photo" library={library} defaultValue={row?.authorPhotoId ? [row.authorPhotoId] : []} />
          <CheckboxField name="needsReview" label="À valider" defaultChecked={row?.needsReview} />
          <TextAreaField name="reviewNote" label="Note de validation (interne)" rows={2} defaultValue={row?.reviewNote} errors={errors} />
        </>
      )}
    </EntityForm>
  );
}

export function StatForm({ action, row }: { action: Action; row?: Stat | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Chiffres affichés dans le hero de l&apos;accueil. Saisissez uniquement des valeurs vérifiables.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="value" label="Valeur" required defaultValue={row?.value} errors={errors} hint="Ex. 19 ou 2020" />
            <TextField name="suffix" label="Suffixe" defaultValue={row?.suffix} errors={errors} hint="Ex. + ou %" />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
          </div>
          <LocalizedField name="label" label="Libellé" required defaultValue={row?.label} errors={errors} />
          <CheckboxField name="isVisible" label="Visible sur le site" defaultChecked={row?.isVisible ?? true} />
        </>
      )}
    </EntityForm>
  );
}

export function SocialForm({ action, row }: { action: Action; row?: SocialLink | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className={grid}>
            <SelectField name="platform" label="Plateforme" options={PLATFORM_OPTIONS} defaultValue={row?.platform} errors={errors} />
            <TextField name="label" label="Libellé" required defaultValue={row?.label} errors={errors} />
            <TextField name="url" label="Adresse" required defaultValue={row?.url} errors={errors} hint="https://... ou mailto:..." />
            <TextField name="handle" label="Identifiant" defaultValue={row?.handle} errors={errors} />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
          </div>
          <CheckboxField name="isVisible" label="Visible sur le site" defaultChecked={row?.isVisible ?? true} />
        </>
      )}
    </EntityForm>
  );
}

export function FaqForm({ action, row }: { action: Action; row?: Faq | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <LocalizedField name="category" label="Catégorie" required defaultValue={row?.category} errors={errors} hint="Ex. Travail, Collaboration, Tarifs : les questions sont regroupées par catégorie" />
          <LocalizedField name="question" label="Question" required defaultValue={row?.question} errors={errors} />
          <LocalizedField name="answer" label="Réponse" required multiline rows={5} defaultValue={row?.answer} errors={errors} hint="Une ligne vide sépare les paragraphes" />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
          </div>
          <div className="space-y-3">
            <CheckboxField name="isVisible" label="Visible sur le site" defaultChecked={row?.isVisible ?? true} />
            <CheckboxField name="showOnHome" label="Afficher aussi sur l'accueil" hint="Les autres questions restent sur la page Contact" defaultChecked={row?.showOnHome ?? false} />
          </div>
        </>
      )}
    </EntityForm>
  );
}

export function PartnerForm({ action, row, library }: { action: Action; row?: Partner | null; library: LibraryItem[] }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className={grid}>
            <TextField name="name" label="Nom" required defaultValue={row?.name} errors={errors} hint="Affiché à côté du logo, ou seul sans logo" />
            <TextField name="url" label="Site web (facultatif)" type="url" defaultValue={row?.url} errors={errors} placeholder="https://" />
            <TextField name="sortOrder" label="Ordre" type="number" defaultValue={row?.sortOrder ?? 0} errors={errors} />
          </div>
          <MediaPicker name="logoMediaId" label="Logo (PNG à fond transparent conseillé, affiché en niveaux de gris)" library={library} defaultValue={row?.logoMediaId ? [row.logoMediaId] : []} />
          <CheckboxField name="isVisible" label="Visible sur le site" defaultChecked={row?.isVisible ?? true} />
        </>
      )}
    </EntityForm>
  );
}
