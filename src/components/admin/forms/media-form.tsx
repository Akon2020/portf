"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import type { FormState } from "@/server/actions/content";
import { EntityForm } from "../entity-form";
import { CheckboxField, LocalizedField } from "../fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function MediaEditForm({
  action,
  deleteAction,
  alt,
  needsReplacement,
}: {
  action: Action;
  deleteAction: (state: FormState) => Promise<FormState>;
  alt: { fr: string; en?: string };
  needsReplacement: boolean;
}) {
  const [deleteState, remove, deleting] = useActionState(deleteAction, {});
  return (
    <div className="space-y-6">
      <EntityForm action={action}>
        {(errors) => (
          <>
            <LocalizedField name="alt" label="Texte alternatif" defaultValue={alt} errors={errors} hint="Décrit l'image pour les lecteurs d'écran et le référencement" />
            <CheckboxField name="needsReplacement" label="À remplacer" hint="Visuel provisoire (Unsplash, maquette) à remplacer par une capture réelle" defaultChecked={needsReplacement} />
          </>
        )}
      </EntityForm>
      <form
        action={remove}
        onSubmit={(event) => {
          if (!window.confirm("Supprimer ce fichier de la médiathèque ?")) event.preventDefault();
        }}
        className="space-y-2"
      >
        <button type="submit" disabled={deleting} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm text-destructive hover:bg-destructive/10">
          <Trash2 className="size-4" aria-hidden="true" />
          Supprimer
        </button>
        {deleteState.message && (
          <p className="text-sm text-destructive" role="alert">
            {deleteState.message}
          </p>
        )}
      </form>
    </div>
  );
}
