"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { loginAction, verifyTwoFactorAction, type AuthFormState } from "@/server/actions/auth";

export const authInputClass =
  "h-11 w-full rounded-xl border bg-card px-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="h-11 w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

const initialState: AuthFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <input id="email" name="email" type="email" autoComplete="username" required className={authInputClass} aria-invalid={!!state.error} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Link href="/auth/mot-de-passe-oublie" className="text-xs font-medium text-accent underline-offset-4 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" required aria-invalid={!!state.error} />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Se connecter</SubmitButton>
    </form>
  );
}

export function TwoFactorForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, initialState);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="code">Code à 6 chiffres ou code de secours</Label>
        <input
          id="code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={20}
          className={`${authInputClass} h-12 text-center font-mono text-xl tracking-[0.4em]`}
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Vérifier</SubmitButton>
    </form>
  );
}
