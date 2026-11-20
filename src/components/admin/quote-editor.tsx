"use client";

import { CheckCircle2, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { computeTotals, formatMoney, lineTotal, parseMoney, parsePercent, type Currency } from "@/lib/money";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { cn } from "@/lib/utils";
import type { QuoteFormState } from "@/server/actions/quotes";

type Action = (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;

export interface EditorQuote {
  title: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  locale: "fr" | "en";
  currency: Currency;
  issueDate: string;
  validUntil: string;
  exchangeRate: string;
  discount: string;
  taxRate: string;
  notes: string;
  terms: string;
  items: { description: string; quantity: string; unitPrice: string }[];
}

const input = "h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function StatusMessage({ state }: { state: QuoteFormState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={state.ok ? "flex items-center gap-1.5 text-sm text-success" : "text-sm text-destructive"}>
      {state.ok && <CheckCircle2 className="size-4" aria-hidden="true" />}
      {state.message}
    </p>
  );
}

export function QuoteEditor({ action, initial }: { action: Action; initial: EditorQuote }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState(initial);
  const [keys, setKeys] = useState(() => initial.items.map((_, index) => index));
  const [nextKey, setNextKey] = useState(initial.items.length);
  const errors = state.errors ?? {};
  const set = <K extends keyof EditorQuote>(key: K, value: EditorQuote[K]) => setValues((current) => ({ ...current, [key]: value }));

  const setItem = (index: number, field: "description" | "quantity" | "unitPrice", value: string) =>
    setValues((current) => ({ ...current, items: current.items.map((item, position) => (position === index ? { ...item, [field]: value } : item)) }));

  const addItem = () => {
    setValues((current) => ({ ...current, items: [...current.items, { description: "", quantity: "1", unitPrice: "" }] }));
    setKeys((current) => [...current, nextKey]);
    setNextKey((value) => value + 1);
  };

  const removeItem = (index: number) => {
    setValues((current) => ({ ...current, items: current.items.filter((_, position) => position !== index) }));
    setKeys((current) => current.filter((_, position) => position !== index));
  };

  const lines = values.items.map((item) => ({ quantity: item.quantity || "0", unitPrice: parseMoney(item.unitPrice || "0") ?? 0 }));
  const totals = computeTotals(lines, parseMoney(values.discount || "0") ?? 0, parsePercent(values.taxRate) ?? 0);
  const money = (cents: number) => formatMoney(cents, values.currency, "fr");

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-6" noValidate>
      <section className="grid gap-4 admin-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Objet du devis" error={errors.title} className="sm:col-span-2 lg:col-span-3">
          <input name="title" value={values.title} onChange={(event) => set("title", event.target.value)} className={input} aria-invalid={!!errors.title} />
        </Field>
        <Field label="Destinataire" error={errors.recipientName}>
          <input name="recipientName" value={values.recipientName} onChange={(event) => set("recipientName", event.target.value)} className={input} />
        </Field>
        <Field label="E-mail" error={errors.recipientEmail}>
          <input name="recipientEmail" type="email" value={values.recipientEmail} onChange={(event) => set("recipientEmail", event.target.value)} className={input} />
        </Field>
        <Field label="WhatsApp ou téléphone" error={errors.recipientPhone}>
          <input name="recipientPhone" value={values.recipientPhone} onChange={(event) => set("recipientPhone", event.target.value)} className={input} placeholder="+243..." />
        </Field>
        <Field label="Date d'émission" error={errors.issueDate}>
          <input name="issueDate" type="date" value={values.issueDate} onChange={(event) => set("issueDate", event.target.value)} className={input} />
        </Field>
        <Field label="Valable jusqu'au" error={errors.validUntil}>
          <input name="validUntil" type="date" value={values.validUntil} onChange={(event) => set("validUntil", event.target.value)} className={input} />
        </Field>
        <Field label="Langue du document">
          <select name="locale" value={values.locale} onChange={(event) => set("locale", event.target.value as "fr" | "en")} className={input}>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label="Devise">
          <select name="currency" value={values.currency} onChange={(event) => set("currency", event.target.value as Currency)} className={input}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </Field>
        <Field label="Taux indicatif (CDF pour 1 USD, facultatif)" error={errors.exchangeRate}>
          <input name="exchangeRate" inputMode="decimal" value={values.exchangeRate} onChange={(event) => set("exchangeRate", event.target.value)} className={input} placeholder="2800" />
        </Field>
      </section>

      <section className="admin-card p-5">
        <h2 className="mb-4 font-sans text-base font-semibold tracking-normal">Lignes</h2>
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_90px_140px_130px_40px] gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Description</span>
            <span className="text-right">Quantité</span>
            <span className="text-right">Prix unitaire</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {values.items.map((item, index) => (
            <div key={keys[index]} className="grid gap-2 rounded-lg border bg-card p-3 md:grid-cols-[1fr_90px_140px_130px_40px] md:items-start md:gap-3 md:border-0 md:bg-transparent md:p-0">
              <div>
                <input
                  name={`items[${index}].description`}
                  aria-label={`Description de la ligne ${index + 1}`}
                  value={item.description}
                  onChange={(event) => setItem(index, "description", event.target.value)}
                  className={input}
                  aria-invalid={!!errors[`items.${index}.description`]}
                />
                {errors[`items.${index}.description`] && <span className="text-xs text-destructive">{errors[`items.${index}.description`]}</span>}
              </div>
              <input
                name={`items[${index}].quantity`}
                aria-label={`Quantité de la ligne ${index + 1}`}
                inputMode="decimal"
                value={item.quantity}
                onChange={(event) => setItem(index, "quantity", event.target.value)}
                className={cn(input, "text-right")}
                aria-invalid={!!errors[`items.${index}.quantity`]}
              />
              <input
                name={`items[${index}].unitPrice`}
                aria-label={`Prix unitaire de la ligne ${index + 1}`}
                inputMode="decimal"
                value={item.unitPrice}
                onChange={(event) => setItem(index, "unitPrice", event.target.value)}
                className={cn(input, "text-right")}
                aria-invalid={!!errors[`items.${index}.unitPrice`]}
              />
              <p className="flex h-10 items-center justify-end text-sm font-medium tabular-nums">{money(lineTotal(lines[index]))}</p>
              <button type="button" onClick={() => removeItem(index)} className="grid size-10 place-items-center rounded-lg border text-muted-foreground hover:text-destructive" aria-label={`Supprimer la ligne ${index + 1}`}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-surface">
          <Plus className="size-4" aria-hidden="true" />
          Ajouter une ligne
        </button>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Remise (montant)" error={errors.discount}>
              <input name="discount" inputMode="decimal" value={values.discount} onChange={(event) => set("discount", event.target.value)} className={input} placeholder="0" />
            </Field>
            <Field label="Taxe (%)" error={errors.taxRate}>
              <input name="taxRate" inputMode="decimal" value={values.taxRate} onChange={(event) => set("taxRate", event.target.value)} className={input} placeholder="0" />
            </Field>
          </div>
          <dl className="space-y-1.5 rounded-lg border bg-card p-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Sous-total</dt>
              <dd className="tabular-nums">{money(totals.subtotal)}</dd>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Remise</dt>
                <dd className="tabular-nums">- {money(totals.discount)}</dd>
              </div>
            )}
            {totals.taxAmount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Taxe</dt>
                <dd className="tabular-nums">{money(totals.taxAmount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(totals.total)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 admin-card p-5 md:grid-cols-2">
        <Field label="Notes (visibles sur le devis)" error={errors.notes}>
          <textarea name="notes" rows={4} value={values.notes} onChange={(event) => set("notes", event.target.value)} className={cn(input, "h-auto py-2")} />
        </Field>
        <Field label="Conditions" error={errors.terms}>
          <textarea name="terms" rows={4} value={values.terms} onChange={(event) => set("terms", event.target.value)} className={cn(input, "h-auto py-2")} />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t bg-background/95 px-4 py-4 backdrop-blur sm:-mx-8 sm:px-8">
        <Button type="submit" disabled={pending} className="h-10 px-5">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Enregistrer le brouillon
        </Button>
        <StatusMessage state={state} />
      </div>
    </form>
  );
}

/** E-mail sending with an optional personal message, and the WhatsApp link. */
export function QuoteSendPanel({
  emailAction,
  whatsappAction,
  hasEmail,
  hasPhone,
  alreadySent,
}: {
  emailAction: Action;
  whatsappAction: () => Promise<{ link?: string; error?: string }>;
  hasEmail: boolean;
  hasPhone: boolean;
  alreadySent: boolean;
}) {
  const [state, formAction, pending] = useActionState(emailAction, {});
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();

  return (
    <section className="space-y-4 admin-card p-5">
      <h2 className="font-sans text-base font-semibold tracking-normal">{alreadySent ? "Renvoyer" : "Envoyer"}</h2>
      {!alreadySent && <p className="text-xs text-muted-foreground">Le premier envoi attribue le numéro définitif et verrouille le devis.</p>}
      <form onSubmit={submitWithoutReset(formAction)} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Message personnel (facultatif)</span>
          <textarea name="message" rows={3} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="copyToSelf" value="1" className="size-4 accent-[var(--accent)]" />
          M&apos;envoyer une copie
        </label>
        <Button type="submit" disabled={pending || !hasEmail} className="h-10 w-full">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          Envoyer par e-mail
        </Button>
        {!hasEmail && <p className="text-xs text-muted-foreground">Ajoutez l&apos;e-mail du destinataire et enregistrez.</p>}
        <StatusMessage state={state} />
      </form>
      <div className="border-t pt-4">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full"
          disabled={!hasPhone || opening}
          onClick={() => {
            setWhatsappError(null);
            // The window is opened synchronously so the browser does not block it.
            const popup = window.open("", "_blank");
            startOpening(async () => {
              const result = await whatsappAction();
              if (result.link && popup) {
                popup.opener = null;
                popup.location.href = result.link;
              } else {
                popup?.close();
                setWhatsappError(result.error ?? "Impossible d'ouvrir WhatsApp.");
              }
            });
          }}
        >
          {opening && <Loader2 className="animate-spin" aria-hidden="true" />}
          Envoyer par WhatsApp
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Ouvre WhatsApp avec un message pré-rempli contenant le lien du devis. Le PDF ne peut pas être joint par ce moyen.
        </p>
        {!hasPhone && <p className="mt-1 text-xs text-muted-foreground">Ajoutez un numéro WhatsApp et enregistrez.</p>}
        {whatsappError && (
          <p className="mt-2 text-sm text-destructive" role="alert">
            {whatsappError}
          </p>
        )}
      </div>
    </section>
  );
}
