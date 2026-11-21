"use client";

import { CheckCircle2, Loader2, MessagesSquare } from "lucide-react";
import { useActionState, useState } from "react";
import { submitWithoutReset } from "@/lib/use-form-submit";
import type { NegotiationState } from "@/server/actions/documents";

const T = {
  fr: {
    open: "Négocier ce devis",
    intro: "Proposez un autre budget, demandez des fonctionnalités supplémentaires, ou les deux. Isaac étudiera votre demande et vous répondra, éventuellement avec une nouvelle version du devis.",
    budget: "Budget proposé (facultatif)",
    features: "Fonctionnalités à ajouter ou à retirer (facultatif)",
    featuresHint: "Une par ligne, par exemple : paiement Mobile Money, version anglaise.",
    message: "Votre message",
    name: "Votre nom",
    send: "Envoyer ma proposition",
    cancel: "Annuler",
    done: "Votre proposition a été envoyée. Vous recevrez la réponse par e-mail.",
    errors: {
      tooShort: "Expliquez votre demande en quelques mots (10 caractères au minimum).",
      invalidAmount: "Montant invalide.",
      invalid: "Ce lien n'est plus valide.",
      closed: "Ce devis n'est plus ouvert à la négociation.",
      expired: "Ce devis a expiré.",
      rateLimited: "Trop de propositions aujourd'hui, réessayez demain ou écrivez directement par e-mail.",
    },
  },
  en: {
    open: "Negotiate this quote",
    intro: "Suggest another budget, ask for additional features, or both. Isaac will review your request and answer, possibly with a new version of the quote.",
    budget: "Proposed budget (optional)",
    features: "Features to add or remove (optional)",
    featuresHint: "One per line, for example: Mobile Money payment, English version.",
    message: "Your message",
    name: "Your name",
    send: "Send my proposal",
    cancel: "Cancel",
    done: "Your proposal has been sent. You will receive the answer by e-mail.",
    errors: {
      tooShort: "Explain your request in a few words (10 characters minimum).",
      invalidAmount: "Invalid amount.",
      invalid: "This link is no longer valid.",
      closed: "This quote is no longer open to negotiation.",
      expired: "This quote has expired.",
      rateLimited: "Too many proposals today, try again tomorrow or write directly by e-mail.",
    },
  },
};

const input = "w-full rounded-xl border bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function QuoteNegotiation({
  locale,
  currency,
  defaultName,
  action,
}: {
  locale: "fr" | "en";
  currency: string;
  defaultName: string;
  action: (state: NegotiationState, formData: FormData) => Promise<NegotiationState>;
}) {
  const t = T[locale];
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, {});

  if (state.done) {
    return (
      <p role="status" className="flex items-start gap-3 rounded-2xl border border-success/40 bg-success/5 p-5 text-sm">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        {t.done}
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:bg-surface">
        <MessagesSquare className="size-4" aria-hidden="true" />
        {t.open}
      </button>
    );
  }

  return (
    <form onSubmit={submitWithoutReset(formAction)} className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{t.open}</h2>
      <p className="text-sm text-muted-foreground">{t.intro}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 text-sm font-medium">
          {t.budget}
          <span className="relative block">
            <input name="proposedTotal" inputMode="decimal" maxLength={20} className={`${input} h-11 pr-14`} />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 grid place-items-center text-xs text-muted-foreground">{currency}</span>
          </span>
        </label>
        <label className="block space-y-1.5 text-sm font-medium">
          {t.name}
          <input name="name" defaultValue={defaultName} maxLength={160} className={`${input} h-11`} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-medium">
        {t.features}
        <textarea name="requestedFeatures" rows={3} maxLength={3000} className={`${input} py-2.5`} aria-describedby="features-hint" />
        <span id="features-hint" className="block text-xs font-normal text-muted-foreground">
          {t.featuresHint}
        </span>
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        {t.message}
        <textarea name="message" rows={4} required minLength={10} maxLength={3000} className={`${input} py-2.5`} />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {t.errors[state.error]}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {t.send}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="inline-flex h-11 items-center rounded-full border px-5 text-sm">
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
