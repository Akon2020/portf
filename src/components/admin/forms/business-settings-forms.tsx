"use client";

import type { FormState } from "@/server/actions/content";
import type { IssuerSettings, TemplatesSettings } from "@/server/content/settings-schema";
import { EntityForm } from "../entity-form";
import { TextAreaField, TextField } from "../fields";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function IssuerSettingsForm({ action, value }: { action: Action; value: IssuerSettings }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Ces informations figurent sur les devis, factures et reçus. Les coordonnées de paiement et les identifiants légaux ne sont jamais
            remplis automatiquement : saisissez vos vraies valeurs.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="name" label="Nom" required defaultValue={value.name} errors={errors} />
            <TextField name="businessName" label="Nom commercial" defaultValue={value.businessName} errors={errors} hint="Ex. Akon Tech" />
            <TextField name="phone" label="Téléphone" defaultValue={value.phone} errors={errors} />
            <TextField name="email" label="E-mail" type="email" defaultValue={value.email} errors={errors} />
            <TextField name="website" label="Site web" defaultValue={value.website} errors={errors} />
            <TextField name="exchangeRate" label="Taux indicatif par défaut (CDF pour 1 USD)" defaultValue={value.exchangeRate} errors={errors} hint="Prérempli sur les nouveaux devis, facultatif" />
          </div>
          <TextAreaField name="address" label="Adresse" rows={2} defaultValue={value.address} errors={errors} />
          <TextAreaField name="legalIds" label="Identifiants légaux (RCCM, ID Nat, NIF)" rows={2} defaultValue={value.legalIds} errors={errors} hint="Facultatif" />
          <TextAreaField name="paymentDetails" label="Modalités de paiement" rows={4} defaultValue={value.paymentDetails} errors={errors} hint="Mobile Money (numéros et noms), banque, espèces" />
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <TextField name="quoteValidityDays" label="Validité des devis (jours)" type="number" defaultValue={value.quoteValidityDays} errors={errors} />
            <TextAreaField name="quoteTerms" label="Conditions par défaut des devis" rows={4} defaultValue={value.quoteTerms} errors={errors} hint="Ex. acompte, délais, révisions incluses" />
            <TextAreaField name="invoiceTerms" label="Conditions par défaut des factures" rows={4} defaultValue={value.invoiceTerms} errors={errors} hint="Ex. pénalités de retard, délai de paiement" />
          </div>
          <TextAreaField name="footer" label="Mention de bas de page" rows={2} defaultValue={value.footer} errors={errors} />
        </>
      )}
    </EntityForm>
  );
}

export function TemplatesSettingsForm({ action, value }: { action: Action; value: TemplatesSettings }) {
  // Two empty slots to add new templates.
  const replies = [...value.replies, null, null];
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <TextAreaField
            name="whatsappQuote"
            label="Message WhatsApp d'envoi de devis"
            rows={4}
            defaultValue={value.whatsappQuote}
            errors={errors}
            hint="Variables disponibles : {client}, {numero}, {total}, {validite}, {lien}"
          />
          <TextAreaField
            name="whatsappInvoice"
            label="Message WhatsApp d'envoi de facture"
            rows={4}
            defaultValue={value.whatsappInvoice}
            errors={errors}
            hint="Variables : {client}, {numero}, {total}, {solde}, {echeance}, {devise}, {lien}"
          />
          <TextAreaField
            name="whatsappReminder"
            label="Message WhatsApp de relance"
            rows={4}
            defaultValue={value.whatsappReminder}
            errors={errors}
            hint="Variables : {client}, {numero}, {total}, {solde}, {echeance}, {devise}, {lien}"
          />
          <TextAreaField
            name="whatsappReceipt"
            label="Message WhatsApp d'envoi de reçu"
            rows={3}
            defaultValue={value.whatsappReceipt}
            errors={errors}
            hint="Variables : {client}, {montant}, {facture}, {numero}, {solde}, {lien}"
          />
          <fieldset className="space-y-4">
            <legend className="text-sm font-medium">Modèles de réponse (laisser le titre vide pour supprimer)</legend>
            {replies.map((reply, index) => (
              <div key={index} className="space-y-3 admin-card p-4">
                <TextField name={`replies[${index}].title`} label={`Titre du modèle ${index + 1}`} defaultValue={reply?.title} errors={errors} />
                <TextAreaField name={`replies[${index}].body`} label="Texte" rows={5} defaultValue={reply?.body} errors={errors} />
              </div>
            ))}
          </fieldset>
        </>
      )}
    </EntityForm>
  );
}
