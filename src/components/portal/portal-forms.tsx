"use client";

import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { useActionState, useState } from "react";
import type { PortalFormState } from "@/server/actions/portal";

type Action = (state: PortalFormState, formData: FormData) => Promise<PortalFormState>;

const primary = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60";

function Feedback({ state }: { state: PortalFormState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={state.ok ? "flex items-start gap-2 text-sm text-success" : "text-sm text-destructive"}>
      {state.ok && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      {state.message}
    </p>
  );
}

export function MagicLinkForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) return <Feedback state={state} />;
  return (
    <form action={formAction} className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Adresse e-mail</span>
        <input name="email" type="email" autoComplete="email" required maxLength={254} className="h-11 w-full rounded-xl border bg-card px-3.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
      </label>
      <button type="submit" disabled={pending} className={`${primary} w-full`}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Mail className="size-4" aria-hidden="true" />}
        Recevoir mon lien de connexion
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ConfirmLinkForm({ action }: { action: () => Promise<PortalFormState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <button type="submit" disabled={pending} className={`${primary} w-full`}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        Me connecter à mon espace
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function PortalMessageForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const [body, setBody] = useState("");
  return (
    <form
      action={async (formData) => {
        formAction(formData);
        setBody("");
      }}
      className="space-y-3"
    >
      <label htmlFor="portal-message" className="sr-only">
        Votre message
      </label>
      <textarea
        id="portal-message"
        name="body"
        rows={4}
        required
        minLength={5}
        maxLength={5000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Une question, une remarque, un retour sur la dernière version..."
        className="w-full rounded-xl border bg-card px-3.5 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || body.trim().length < 5} className={primary}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          Envoyer
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
