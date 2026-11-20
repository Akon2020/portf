"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { submitWithoutReset } from "@/lib/use-form-submit";
import type { DecisionState } from "@/server/actions/documents";

const T = {
  fr: {
    title: "Accepter ce devis",
    name: "Votre nom complet",
    agree: "J'accepte ce devis et ses conditions.",
    accept: "Accepter le devis",
    decline: "Refuser le devis",
    confirmDecline: "Confirmer le refus de ce devis ?",
    accepted: "Merci, le devis est accepté. Isaac Akonkwa revient vers vous très vite pour la suite.",
    declined: "Votre refus a bien été enregistré. Merci pour votre retour.",
    errors: {
      name: "Indiquez votre nom et cochez la case d'acceptation.",
      invalid: "Ce lien n'est plus valide.",
      closed: "Ce devis a déjà reçu une réponse.",
      expired: "Ce devis a expiré. Demandez une version à jour.",
    },
  },
  en: {
    title: "Accept this quote",
    name: "Your full name",
    agree: "I accept this quote and its terms.",
    accept: "Accept the quote",
    decline: "Decline the quote",
    confirmDecline: "Confirm that you decline this quote?",
    accepted: "Thank you, the quote is accepted. Isaac Akonkwa will get back to you shortly about next steps.",
    declined: "Your answer has been recorded. Thank you for your feedback.",
    errors: {
      name: "Enter your name and tick the acceptance box.",
      invalid: "This link is no longer valid.",
      closed: "This quote has already been answered.",
      expired: "This quote has expired. Ask for an updated version.",
    },
  },
};

export function QuoteDecision({
  locale,
  acceptAction,
  declineAction,
}: {
  locale: "fr" | "en";
  acceptAction: (state: DecisionState, formData: FormData) => Promise<DecisionState>;
  declineAction: (state: DecisionState) => Promise<DecisionState>;
}) {
  const t = T[locale];
  const [acceptState, accept, accepting] = useActionState(acceptAction, {});
  const [declineState, decline, declining] = useActionState(declineAction, {});
  const done = acceptState.done ?? declineState.done;
  const error = acceptState.error ?? declineState.error;

  if (done) {
    return (
      <div role="status" className="flex gap-3 rounded-2xl border border-success/40 bg-success/5 p-6">
        <CheckCircle2 className="size-6 shrink-0 text-success" aria-hidden="true" />
        <p>{done === "accepted" ? t.accepted : t.declined}</p>
      </div>
    );
  }

  return (
    <section aria-labelledby="decision" className="space-y-4 rounded-2xl border bg-card p-6">
      <h2 id="decision" className="font-sans text-lg font-semibold tracking-normal">
        {t.title}
      </h2>
      <form onSubmit={submitWithoutReset(accept)} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{t.name}</span>
          <input name="name" autoComplete="name" required minLength={2} maxLength={160} className="h-11 w-full rounded-xl border bg-background px-4" />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="agree" value="1" required className="mt-0.5 size-4 accent-[var(--accent)]" />
          {t.agree}
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t.errors[error]}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={accepting} className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground disabled:opacity-60">
            {accepting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t.accept}
          </button>
          <button
            type="button"
            disabled={declining}
            onClick={() => {
              if (window.confirm(t.confirmDecline)) startTransition(() => decline());
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:bg-surface disabled:opacity-60"
          >
            {declining && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t.decline}
          </button>
        </div>
      </form>
    </section>
  );
}
