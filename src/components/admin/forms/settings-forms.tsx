"use client";

import type { FormState } from "@/server/actions/content";
import type { ContactSettings, CvSettings, LegalSettings, ProfileSettings } from "@/server/content/settings-schema";
import { EntityForm } from "../entity-form";
import { CheckboxField, LocalizedField, SelectField, TextField } from "../fields";
import { MediaPicker, type LibraryItem } from "../media-picker";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function ProfileSettingsForm({ action, value, library }: { action: Action; value: ProfileSettings; library: LibraryItem[] }) {
  const values = [...value.values, ...Array.from({ length: Math.max(0, 6 - value.values.length) }, () => null)];
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="name" label="Nom affiché" required defaultValue={value.name} errors={errors} />
            <TextField name="foundedYear" label="Année de début (Akon Tech)" type="number" defaultValue={value.foundedYear} errors={errors} />
            <SelectField
              name="slogan"
              label="Slogan du footer"
              options={[
                { value: "Made with intention.", label: "Made with intention." },
                { value: "Building code that builds change.", label: "Building code that builds change." },
              ]}
              defaultValue={value.slogan}
              errors={errors}
            />
          </div>
          <div className="admin-card p-5">
            <CheckboxField name="available" label="Disponible pour de nouvelles collaborations" hint="Affiche le badge de disponibilité dans le hero" defaultChecked={value.available} />
            <div className="mt-4">
              <LocalizedField name="availabilityLabel" label="Texte du badge" required defaultValue={value.availabilityLabel} errors={errors} />
            </div>
          </div>
          <LocalizedField name="title" label="Titre" required defaultValue={value.title} errors={errors} />
          <LocalizedField name="location" label="Localisation" defaultValue={value.location} errors={errors} />
          <LocalizedField name="heroHeading" label="Accroche du hero" required multiline rows={2} defaultValue={value.heroHeading} errors={errors} />
          <LocalizedField name="heroIntro" label="Sous-titre du hero" required multiline rows={3} defaultValue={value.heroIntro} errors={errors} />
          <LocalizedField name="tagline" label="Description courte (SEO, données structurées)" required multiline rows={2} defaultValue={value.tagline} errors={errors} />
          <LocalizedField name="profileHeading" label="Titre de la section Profil" required defaultValue={value.profileHeading} errors={errors} />
          <LocalizedField name="profileText" label="Texte de la section Profil" required multiline defaultValue={value.profileText} errors={errors} />
          <LocalizedField name="bioLong" label="Biographie longue (page À propos)" multiline rows={8} defaultValue={value.bioLong} errors={errors} hint="Une ligne vide sépare les paragraphes" />
          <MediaPicker name="portraitMediaId" label="Portrait" library={library} defaultValue={value.portraitMediaId ? [value.portraitMediaId] : []} />
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Valeurs (6 maximum, laisser vide pour retirer)</legend>
            {values.map((item, index) => (
              <div key={index} className="space-y-3 admin-card p-4">
                <LocalizedField name={`values[${index}].title`} label={`Valeur ${index + 1}`} defaultValue={item?.title} errors={errors} />
                <LocalizedField name={`values[${index}].text`} label="Description" multiline rows={2} defaultValue={item?.text} errors={errors} />
              </div>
            ))}
          </fieldset>
        </>
      )}
    </EntityForm>
  );
}

export function ContactSettingsForm({ action, value }: { action: Action; value: ContactSettings }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="email" label="E-mail de contact" type="email" required defaultValue={value.email} errors={errors} />
            <TextField name="whatsapp" label="WhatsApp" defaultValue={value.whatsapp} errors={errors} hint="Format international, ex. +243 970 000 000" />
            <TextField name="calendlyUrl" label="Lien Calendly" type="url" defaultValue={value.calendlyUrl} errors={errors} />
          </div>
          <LocalizedField name="contactHeading" label="Titre de l'appel au contact" required defaultValue={value.contactHeading} errors={errors} />
          <LocalizedField name="contactText" label="Texte de l'appel au contact" required multiline rows={2} defaultValue={value.contactText} errors={errors} />
          <LocalizedField name="openTo" label="Ouvert à" required multiline rows={2} defaultValue={value.openTo} errors={errors} />
          <LocalizedField name="responseTime" label="Délai de réponse" required defaultValue={value.responseTime} errors={errors} />
        </>
      )}
    </EntityForm>
  );
}

export function LegalSettingsForm({ action, value }: { action: Action; value: LegalSettings }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Laisser vide pour utiliser le texte par défaut. Format : un titre sur une ligne, le paragraphe juste en dessous, une ligne vide entre deux blocs.
          </p>
          <LocalizedField name="legalNotice" label="Mentions légales" multiline rows={14} defaultValue={value.legalNotice} errors={errors} />
          <LocalizedField name="privacyPolicy" label="Politique de confidentialité" multiline rows={14} defaultValue={value.privacyPolicy} errors={errors} />
        </>
      )}
    </EntityForm>
  );
}

export function CvSettingsForm({ action, value, library }: { action: Action; value: CvSettings; library: LibraryItem[] }) {
  return (
    <EntityForm action={action}>
      {() => (
        <div className="grid gap-6 sm:grid-cols-2">
          <MediaPicker name="frMediaId" label="CV en français (PDF)" accept="application/pdf" library={library} defaultValue={value.frMediaId ? [value.frMediaId] : []} />
          <MediaPicker name="enMediaId" label="CV en anglais (PDF, facultatif)" accept="application/pdf" library={library} defaultValue={value.enMediaId ? [value.enMediaId] : []} hint="Sinon la version française est proposée" />
        </div>
      )}
    </EntityForm>
  );
}
