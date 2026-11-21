"use client";

import { useState } from "react";
import { slugify } from "@/lib/slug";
import type { FormState } from "@/server/actions/content";
import type { GalleryAlbum } from "@/server/db/schema";
import { AlbumItemsEditor, type AlbumItemValue } from "../album-items-editor";
import { EntityForm } from "../entity-form";
import { Field, LocalizedField, SelectField, TextField } from "../fields";
import { STATUS_OPTIONS } from "../labels";
import { MediaPicker, type LibraryItem } from "../media-picker";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function AlbumForm({ action, album, items, library }: { action: Action; album?: GalleryAlbum | null; items: AlbumItemValue[]; library: LibraryItem[] }) {
  const [slug, setSlug] = useState(album?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!album);
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <section className="space-y-5 admin-card p-5 sm:p-6">
            <div
              onInput={(event) => {
                const target = event.target as HTMLInputElement;
                if (!slugTouched && target.name === "title.fr") setSlug(slugify(target.value));
              }}
            >
              <LocalizedField name="title" label="Titre" required defaultValue={album?.title} errors={errors} />
            </div>
            <Field label="Slug (adresse)" htmlFor="slug" error={errors.slug} hint="/galerie/slug et /en/gallery/slug" required>
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
            <LocalizedField name="description" label="Description" multiline rows={3} defaultValue={album?.description} errors={errors} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectField name="status" label="Statut" options={STATUS_OPTIONS} defaultValue={album?.status ?? "draft"} errors={errors} />
              <TextField name="eventDate" label="Date de l'événement" type="date" defaultValue={album?.eventDate} errors={errors} />
              <TextField name="location" label="Lieu" defaultValue={album?.location} errors={errors} placeholder="Bukavu, RDC" />
              <TextField name="sortOrder" label="Ordre" type="number" defaultValue={album?.sortOrder ?? 0} errors={errors} />
            </div>
            <MediaPicker name="coverImageId" label="Couverture" library={library} defaultValue={album?.coverImageId ? [album.coverImageId] : []} hint="Sinon la première photo est utilisée" />
          </section>
          <section className="space-y-4 admin-card p-5 sm:p-6">
            <h2 className="text-base font-semibold">Photos</h2>
            <AlbumItemsEditor library={library} defaultValue={items} />
            {errors.items && <p className="text-sm text-destructive">{errors.items}</p>}
          </section>
        </>
      )}
    </EntityForm>
  );
}
