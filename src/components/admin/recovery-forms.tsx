"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RecoveryState } from "@/server/actions/recovery";

type Action = (state: RecoveryState, formData: FormData) => Promise<RecoveryState>;

function Done({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-success" role="status">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </p>
      <Link href="/auth/login" className="text-sm underline underline-offset-4">
        Retour à la connexion
      </Link>
    </div>
  );
}

export function RequestResetForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.done) return <Done>Si un compte existe pour cette adresse, un lien valable 30 minutes vient d&apos;être envoyé.</Done>;
  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="h-10" />
      </div>
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Envoyer le lien
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.done) return <Done>Mot de passe modifié. Toutes les sessions ont été fermées : reconnectez-vous avec votre code TOTP.</Done>;
  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe (12 caractères minimum)</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmation">Confirmation</Label>
        <Input id="confirmation" name="confirmation" type="password" autoComplete="new-password" minLength={12} required className="h-10" />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        Enregistrer
      </Button>
    </form>
  );
}

/** POST confirmation, so link scanners in mail clients cannot trigger the action. */
export function ConfirmTokenForm({ action, label }: { action: (state: RecoveryState) => Promise<RecoveryState>; label: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.done) return <Done>Toutes les sessions ont été révoquées. Changez maintenant votre mot de passe.</Done>;
  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="destructive" className="h-10 w-full" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
        {label}
      </Button>
    </form>
  );
}
