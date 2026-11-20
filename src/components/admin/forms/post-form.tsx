"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";
import type { FormState } from "@/server/actions/content";
import type { Post } from "@/server/db/schema";
import { EntityForm } from "../entity-form";
import { CheckboxField, Field, LocalizedField, SelectField, TextAreaField, TextField } from "../fields";
import { MediaPicker, type LibraryItem } from "../media-picker";
import { RichTextEditor } from "../rich-text-editor";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function toLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PostForm({ action, post, library }: { action: Action; post?: Post | null; library: LibraryItem[] }) {
  const [tab, setTab] = useState<"fr" | "en">("fr");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!post);

  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <section className="space-y-5 admin-card p-5">
            <div
              onInput={(event) => {
                const target = event.target as HTMLInputElement;
                if (!slugTouched && target.name === "title.fr") setSlug(slugify(target.value));
              }}
            >
              <LocalizedField name="title" label="Titre" required defaultValue={post?.title} errors={errors} />
            </div>
            <Field label="Slug (adresse)" htmlFor="slug" error={errors.slug} hint="Identique en français et en anglais : /blog/slug et /en/blog/slug" required>
              <input
                id="slug"
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                className="h-10 w-full rounded-lg border bg-card px-3 font-mono text-sm"
              />
            </Field>
            <LocalizedField name="excerpt" label="Résumé" multiline rows={2} defaultValue={post?.excerpt} errors={errors} hint="Affiché dans la liste, les partages et le flux RSS" />
          </section>

          <section className="space-y-3">
            <div role="tablist" aria-label="Langue du contenu" className="flex gap-1 border-b">
              {(["fr", "en"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  role="tab"
                  aria-selected={tab === lang}
                  aria-controls={`panel-${lang}`}
                  onClick={() => setTab(lang)}
                  className={cn(
                    "border-b-2 px-3 py-2 text-sm",
                    tab === lang ? "border-accent font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {lang === "fr" ? "Français" : "English (facultatif)"}
                </button>
              ))}
            </div>
            {/* Both editors stay mounted so switching tabs never loses content. */}
            <div id="panel-fr" role="tabpanel" hidden={tab !== "fr"}>
              <RichTextEditor name="content.fr" label="Contenu en français" initial={post?.contentJson.fr} library={library} lang="fr" />
            </div>
            <div id="panel-en" role="tabpanel" hidden={tab !== "en"}>
              <RichTextEditor
                name="content.en"
                label="Contenu en anglais"
                initial={post?.contentJson.en}
                library={library}
                lang="en"
                placeholder="Laisser vide pour afficher la version française sur /en"
              />
            </div>
            {(errors["content.fr"] || errors["content.en"]) && <p className="text-sm text-destructive">{errors["content.fr"] ?? errors["content.en"]}</p>}
          </section>

          <section className="grid gap-5 admin-card p-5 lg:grid-cols-2">
            <div className="space-y-4">
              <SelectField
                name="status"
                label="Statut"
                defaultValue={post?.status ?? "draft"}
                errors={errors}
                options={[
                  { value: "draft", label: "Brouillon" },
                  { value: "scheduled", label: "Programmé" },
                  { value: "published", label: "Publié" },
                ]}
              />
              <TextField
                name="publishedAt"
                label="Date de publication"
                type="datetime-local"
                defaultValue={toLocalInput(post?.publishedAt)}
                errors={errors}
                hint="Obligatoire pour programmer, sinon la date de publication effective est utilisée"
              />
              <TextField name="category" label="Catégorie" defaultValue={post?.category} errors={errors} hint="Ex. Web, Mobile, IA, Sécurité, Parcours" />
              <TextField name="tags" label="Tags" defaultValue={post?.tags.join(", ")} errors={errors} hint="Séparés par des virgules" />
            </div>
            <MediaPicker name="coverImageId" label="Image de couverture" library={library} defaultValue={post?.coverImageId ? [post.coverImageId] : []} />
          </section>

          <section className="space-y-4 admin-card p-5">
            <h2 className="font-sans text-base font-semibold tracking-normal">Référencement et validation</h2>
            <LocalizedField name="seoTitle" label="Titre SEO (facultatif)" defaultValue={post?.seoTitle} errors={errors} />
            <LocalizedField name="seoDescription" label="Description SEO (facultatif)" multiline rows={2} defaultValue={post?.seoDescription} errors={errors} />
            <CheckboxField name="needsReview" label="À valider" defaultChecked={post?.needsReview} />
            <TextAreaField name="reviewNote" label="Note de validation (interne)" rows={2} defaultValue={post?.reviewNote} errors={errors} />
          </section>
        </>
      )}
    </EntityForm>
  );
}
