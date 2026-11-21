"use client";

import { CheckCircle2, Loader2, MessageCircle, Plus, Upload } from "lucide-react";
import { startTransition, useActionState, useState, useTransition } from "react";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { cn } from "@/lib/utils";
import type { CrmFormState } from "@/server/actions/crm";
import type { Client, ClientProject, Milestone } from "@/server/db/schema";
import { EntityForm } from "./entity-form";
import { CheckboxField, SelectField, TextAreaField, TextField } from "./fields";

type Action = (state: CrmFormState, formData: FormData) => Promise<CrmFormState>;

const inputClass = "h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
const primary = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60";
const secondary = "inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface disabled:opacity-60";

export function Message({ state }: { state: CrmFormState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={state.ok ? "flex items-center gap-1.5 text-sm text-success" : "text-sm text-destructive"}>
      {state.ok && <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
      {state.message}
    </p>
  );
}

export const CLIENT_PROJECT_STATUS_OPTIONS = [
  { value: "lead", label: "Prospect" },
  { value: "planned", label: "Planifié" },
  { value: "in_progress", label: "En cours" },
  { value: "review", label: "En recette" },
  { value: "on_hold", label: "En pause" },
  { value: "delivered", label: "Livré" },
  { value: "maintenance", label: "Maintenance" },
  { value: "cancelled", label: "Annulé" },
];

export const MILESTONE_STATUS_OPTIONS = [
  { value: "pending", label: "À faire" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
];

const money = (cents: number | null | undefined) => (cents === null || cents === undefined ? "" : (cents / 100).toFixed(2).replace(".", ",").replace(/,00$/, ""));

export function ClientForm({ action, client }: { action: Action; client?: Client | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <>
          <section className="space-y-4 admin-card p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                name="type"
                label="Type"
                options={[
                  { value: "person", label: "Particulier" },
                  { value: "company", label: "Organisation" },
                ]}
                defaultValue={client?.type ?? "person"}
                errors={errors}
              />
              <TextField name="name" label="Nom ou raison sociale" required defaultValue={client?.name} errors={errors} className="sm:col-span-2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField name="contactName" label="Personne de contact" defaultValue={client?.contactName} errors={errors} />
              <TextField name="email" label="E-mail" type="email" defaultValue={client?.email} errors={errors} />
              <TextField name="whatsapp" label="WhatsApp" defaultValue={client?.whatsapp} errors={errors} placeholder="+243 970 000 000" />
              <TextField name="phone" label="Téléphone" defaultValue={client?.phone} errors={errors} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField name="address" label="Adresse" defaultValue={client?.address} errors={errors} />
              <TextField name="city" label="Ville" defaultValue={client?.city} errors={errors} />
              <TextField name="country" label="Pays" defaultValue={client?.country ?? "RDC"} errors={errors} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="taxId" label="Identifiants légaux (RCCM, ID Nat, NIF)" defaultValue={client?.taxId} errors={errors} />
              <TextField name="tags" label="Étiquettes" defaultValue={client?.tags.join(", ")} errors={errors} hint="Séparées par des virgules" />
            </div>
            <TextAreaField name="notes" label="Notes internes" rows={3} defaultValue={client?.notes} errors={errors} />
          </section>
        </>
      )}
    </EntityForm>
  );
}

export function ClientProjectForm({ action, project }: { action: Action; project?: ClientProject | null }) {
  return (
    <EntityForm action={action}>
      {(errors) => (
        <section className="space-y-4 admin-card p-5 sm:p-6">
          <TextField name="name" label="Nom du projet" required defaultValue={project?.name} errors={errors} />
          <TextAreaField name="description" label="Description" rows={3} defaultValue={project?.description} errors={errors} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField name="status" label="Statut" options={CLIENT_PROJECT_STATUS_OPTIONS} defaultValue={project?.status ?? "planned"} errors={errors} />
            <TextField name="startDate" label="Début" type="date" defaultValue={project?.startDate} errors={errors} />
            <TextField name="dueDate" label="Échéance" type="date" defaultValue={project?.dueDate} errors={errors} />
            <TextField name="progress" label="Avancement manuel (%)" type="number" defaultValue={project?.progress} errors={errors} hint="Vide : calculé depuis les jalons" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextField name="budget" label="Budget" inputMode="decimal" defaultValue={money(project?.budget)} errors={errors} />
            <SelectField
              name="currency"
              label="Devise"
              options={[
                { value: "USD", label: "USD" },
                { value: "CDF", label: "CDF" },
              ]}
              defaultValue={project?.currency ?? "USD"}
              errors={errors}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="repoUrl" label="Dépôt de code" type="url" defaultValue={project?.repoUrl} errors={errors} placeholder="https://" />
            <TextField name="stagingUrl" label="Préproduction" type="url" defaultValue={project?.stagingUrl} errors={errors} placeholder="https://" />
            <TextField name="productionUrl" label="Production" type="url" defaultValue={project?.productionUrl} errors={errors} placeholder="https://" />
          </div>
          <CheckboxField name="visibleToClient" label="Visible dans l'espace client" defaultChecked={project?.visibleToClient ?? true} />
        </section>
      )}
    </EntityForm>
  );
}

/** Inline milestone editor: one compact form per milestone, plus one to add. */
export function MilestoneForm({ action, milestone, onDone }: { action: Action; milestone?: Milestone; onDone?: () => void }) {
  const [state, formAction, pending] = useActionState(async (previous: CrmFormState, formData: FormData) => {
    const result = await action(previous, formData);
    if (result.ok) onDone?.();
    return result;
  }, {});
  const errors = state.errors ?? {};
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-3" key={milestone?.id ?? (state.ok ? "reset" : "new")}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <label className="space-y-1 text-xs font-medium">
          Titre
          <input name="title" defaultValue={milestone?.title} required className={inputClass} aria-invalid={!!errors.title} />
          {errors.title && <span className="block text-destructive">{errors.title}</span>}
        </label>
        <label className="space-y-1 text-xs font-medium">
          Échéance
          <input name="dueDate" type="date" defaultValue={milestone?.dueDate ?? ""} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Statut
          <select name="status" defaultValue={milestone?.status ?? "pending"} className={inputClass}>
            {MILESTONE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Montant facturable
          <input name="amount" inputMode="decimal" defaultValue={money(milestone?.amount)} className={inputClass} aria-invalid={!!errors.amount} />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-medium">
        Description
        <input name="description" defaultValue={milestone?.description ?? ""} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="visibleToClient" value="1" defaultChecked={milestone?.visibleToClient ?? true} className="size-4 accent-[var(--accent)]" />
          Visible par le client
        </label>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : milestone ? null : <Plus className="size-4" aria-hidden="true" />}
          {milestone ? "Enregistrer" : "Ajouter le jalon"}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function ProjectUpdateForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState("");
  return (
    <form
      onSubmit={submitWithoutReset(async (formData) => {
        formAction(formData);
        setBody("");
      })}
      className="space-y-3"
    >
      <label htmlFor="update-body" className="sr-only">
        Nouvelle note
      </label>
      <textarea id="update-body" name="body" rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Ce qui a avancé, ce qui bloque, la prochaine étape..." className={cn(inputClass, "h-auto py-2")} />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="visibleToClient" value="1" defaultChecked className="size-4 accent-[var(--accent)]" />
          Visible par le client
        </label>
        <button type="submit" disabled={pending || body.trim().length < 2} className={primary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Publier la note
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function ProjectFilesForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const target = event.currentTarget;
        const formData = new FormData(target);
        startTransition(() => formAction(formData));
        target.reset();
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          Fichiers (PDF ou images, 10 Mo, 5 maximum)
          <input name="files" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" required className="block w-full text-sm file:mr-3 file:h-9 file:rounded-lg file:border file:bg-card file:px-3 file:text-xs" />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Note (facultatif)
          <input name="note" maxLength={300} className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="visibleToClient" value="1" defaultChecked className="size-4 accent-[var(--accent)]" />
          Visible par le client
        </label>
        <button type="submit" disabled={pending} className={primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
          Envoyer
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

const PAYMENT_METHODS = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "airtel_money", label: "Airtel Money" },
  { value: "orange_money", label: "Orange Money" },
  { value: "cash", label: "Espèces" },
  { value: "bank_transfer", label: "Virement bancaire" },
  { value: "card", label: "Carte bancaire" },
  { value: "other", label: "Autre" },
];

export function PaymentForm({ action, balance, currency, today, hasEmail }: { action: Action; balance: number; currency: string; today: string; hasEmail: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.errors ?? {};
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-3" key={state.ok ? state.message : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          Montant ({currency})
          <input name="amount" inputMode="decimal" defaultValue={money(balance)} required className={inputClass} aria-invalid={!!errors.amount} />
          {errors.amount && <span className="block text-destructive">{errors.amount}</span>}
        </label>
        <label className="space-y-1 text-xs font-medium">
          Date
          <input name="paidAt" type="date" defaultValue={today} max={today} required className={inputClass} aria-invalid={!!errors.paidAt} />
          {errors.paidAt && <span className="block text-destructive">{errors.paidAt}</span>}
        </label>
        <label className="space-y-1 text-xs font-medium">
          Moyen de paiement
          <select name="method" defaultValue="mpesa" className={inputClass}>
            {PAYMENT_METHODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium">
          Référence de transaction
          <input name="reference" maxLength={120} className={inputClass} />
        </label>
      </div>
      <label className="block space-y-1 text-xs font-medium">
        Note (facultatif, imprimée sur le reçu)
        <input name="note" maxLength={1000} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="sendReceipt" value="1" defaultChecked={hasEmail} disabled={!hasEmail} className="size-4 accent-[var(--accent)]" />
        Envoyer le reçu par e-mail
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={primary}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Enregistrer le paiement
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function CancelInvoiceForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form
      onSubmit={(event) => {
        if (!window.confirm("Annuler définitivement cette facture ? Son numéro ne sera jamais réutilisé.")) {
          event.preventDefault();
          return;
        }
        submitWithoutReset(formAction)(event);
      }}
      className="space-y-2"
    >
      <label className="block space-y-1 text-xs font-medium">
        Motif de l&apos;annulation
        <input name="reason" maxLength={500} className={inputClass} placeholder="Erreur de montant, doublon..." />
      </label>
      <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-destructive/40 bg-card px-3 text-xs font-medium text-destructive hover:bg-destructive/5">
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        Annuler la facture
      </button>
      <Message state={state} />
    </form>
  );
}

/** Runs a server action returning a state, with optional confirmation, and shows its message. */
export function ResultButton({ action, label, confirmText, tone = "neutral" }: { action: () => Promise<CrmFormState>; label: string; confirmText?: string; tone?: "neutral" | "danger" }) {
  const [state, setState] = useState<CrmFormState>({});
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirmText && !window.confirm(confirmText)) return;
          start(async () => setState((await action()) ?? {}));
        }}
        className={cn(secondary, tone === "danger" && "text-destructive hover:bg-destructive/5")}
      >
        {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        {label}
      </button>
      <Message state={state} />
    </span>
  );
}

/** Opens WhatsApp in a window created synchronously, so the browser does not block it. */
export function WhatsappButton({ action, label = "WhatsApp" }: { action: () => Promise<{ link?: string; error?: string }>; label?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          const popup = window.open("", "_blank");
          start(async () => {
            const result = await action();
            if (result.link && popup) {
              popup.opener = null;
              popup.location.href = result.link;
            } else {
              popup?.close();
              setError(result.error ?? "Impossible d'ouvrir WhatsApp.");
            }
          });
        }}
        className={secondary}
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <MessageCircle className="size-3.5" aria-hidden="true" />}
        {label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
