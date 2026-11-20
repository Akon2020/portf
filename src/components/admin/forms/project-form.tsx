"use client";

import type { Project } from "@/server/db/schema";
import type { FormState } from "@/server/actions/content";
import { EntityForm } from "../entity-form";
import {
  CheckboxField,
  CheckboxGroup,
  LocalizedField,
  LocalizedListField,
  SelectField,
  TextAreaField,
  TextField,
} from "../fields";
import { MediaPicker, type LibraryItem } from "../media-picker";
import { CATEGORY_OPTIONS, PROJECT_TYPE_OPTIONS, STAGE_OPTIONS, STATUS_OPTIONS } from "../labels";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 rounded-xl border bg-card/40 p-5 sm:p-6">
      <h2 className="font-sans text-base font-semibold tracking-normal">{title}</h2>
      {children}
    </section>
  );
}

export function ProjectForm({
  action,
  project,
  galleryIds,
  library,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  project?: Project | null;
  galleryIds?: string[];
  library: LibraryItem[];
}) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <Section title="Publication">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField name="status" label="Statut" options={STATUS_OPTIONS} defaultValue={project?.status ?? "draft"} errors={errors} />
              <TextField name="sortOrder" label="Ordre d'affichage" type="number" defaultValue={project?.sortOrder ?? 0} errors={errors} />
              <TextField name="slug" label="Slug (adresse)" defaultValue={project?.slug} errors={errors} required hint="Ex. diasmart, identique en FR et EN" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CheckboxField name="isFeatured" label="À la une" hint="Affiché sur la page d'accueil" defaultChecked={project?.isFeatured} />
              <CheckboxField name="confidential" label="Projet confidentiel" hint="Nom du client masqué sur le site" defaultChecked={project?.confidential} />
              <CheckboxField name="needsReview" label="À valider" hint="Apparaît dans la liste « À valider »" defaultChecked={project?.needsReview} />
            </div>
            <TextAreaField name="reviewNote" label="Note de validation (interne)" rows={2} defaultValue={project?.reviewNote} errors={errors} />
          </Section>

          <Section title="Présentation">
            <LocalizedField name="title" label="Titre" required defaultValue={project?.title} errors={errors} />
            <LocalizedField name="summary" label="Résumé" multiline rows={3} defaultValue={project?.summary} errors={errors} hint="Affiché sur les cartes et en description SEO par défaut" />
            <CheckboxGroup name="categories" label="Catégories" options={CATEGORY_OPTIONS} defaultValue={project?.categories} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField name="stage" label="Stade" options={STAGE_OPTIONS} defaultValue={project?.stage ?? "completed"} errors={errors} />
              <SelectField name="projectType" label="Type" options={PROJECT_TYPE_OPTIONS} defaultValue={project?.projectType ?? "personal"} errors={errors} />
            </div>
            <TextField name="techStack" label="Stack technique" defaultValue={project?.techStack.join(", ")} errors={errors} hint="Séparée par des virgules" />
          </Section>

          <Section title="Étude de cas">
            <LocalizedField name="problem" label="Problème" multiline defaultValue={project?.problem} errors={errors} />
            <LocalizedField name="objective" label="Objectif" multiline defaultValue={project?.objective} errors={errors} />
            <LocalizedField name="role" label="Rôle" multiline defaultValue={project?.role} errors={errors} />
            <LocalizedField name="body" label="Contexte et détails" multiline rows={8} defaultValue={project?.body} errors={errors} hint="Une ligne vide sépare les paragraphes" />
            <LocalizedListField name="results" label="Résultats chiffrés" withValue valueLabel="Valeur (ex. 92 %)" itemLabel="Libellé" defaultValue={project?.results} />
          </Section>

          <Section title="Visuels">
            <MediaPicker name="coverImageId" label="Image principale" library={library} defaultValue={project?.coverImageId ? [project.coverImageId] : []} />
            <MediaPicker name="galleryIds" label="Galerie" multiple library={library} defaultValue={galleryIds} hint="L'ordre est celui de la galerie" />
          </Section>

          <Section title="Liens et dates">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="demoUrl" label="Lien de démo" type="url" defaultValue={project?.demoUrl} errors={errors} placeholder="https://" />
              <TextField name="repoUrl" label="Lien du code" type="url" defaultValue={project?.repoUrl} errors={errors} placeholder="https://" />
              <TextField name="startedAt" label="Début" type="date" defaultValue={project?.startedAt} errors={errors} />
              <TextField name="endedAt" label="Fin" type="date" defaultValue={project?.endedAt} errors={errors} />
              <TextField name="clientName" label="Client" defaultValue={project?.clientName} errors={errors} hint="Jamais affiché si le projet est confidentiel" />
            </div>
          </Section>

          <Section title="Référencement (facultatif)">
            <LocalizedField name="seoTitle" label="Titre SEO" defaultValue={project?.seoTitle} errors={errors} />
            <LocalizedField name="seoDescription" label="Description SEO" multiline rows={2} defaultValue={project?.seoDescription} errors={errors} />
          </Section>
        </>
      )}
    </EntityForm>
  );
}
