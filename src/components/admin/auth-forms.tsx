"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmTotpSetupAction,
  loginAction,
  verifyTwoFactorAction,
  type AuthFormState,
} from "@/server/actions/auth";

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="h-10 w-full" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  );
}

const initialState: AuthFormState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return (
    <form action={action} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="h-10" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mot de passe</Label>
          <Link href="/admin/mot-de-passe-oublie" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10"
        />
      </div>
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Se connecter</SubmitButton>
    </form>
  );
}

function CodeInput({ allowBackup }: { allowBackup: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor="code">{allowBackup ? "Code à 6 chiffres ou code de secours" : "Code à 6 chiffres"}</Label>
      <Input
        id="code"
        name="code"
        inputMode={allowBackup ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoFocus
        required
        maxLength={allowBackup ? 20 : 6}
        className="h-12 text-center font-mono text-xl tracking-[0.4em]"
      />
    </div>
  );
}

export function TwoFactorForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, initialState);
  return (
    <form action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <CodeInput allowBackup />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Vérifier</SubmitButton>
    </form>
  );
}

export function TotpSetupForm({ alreadyEnabled = false }: { alreadyEnabled?: boolean }) {
  const [state, action, pending] = useActionState(confirmTotpSetupAction, initialState);
  const [copied, setCopied] = useState(false);

  if (state.backupCodes) {
    const text = state.backupCodes.join("\n");
    return (
      <div className="space-y-5">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <Check className="size-4" aria-hidden="true" />
          Double authentification activée.
        </p>
        <p className="text-sm text-muted-foreground">
          Conservez ces 10 codes de secours en lieu sûr. Chacun ne fonctionne qu&apos;une fois et ils ne
          seront plus jamais affichés.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-lg border bg-card p-4 font-mono text-sm">
          {state.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1"
            onClick={async () => {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiés" : "Copier les codes"}
          </Button>
          <Link href="/admin" className={buttonVariants({ className: "h-10 flex-1" })}>
            J&apos;ai enregistré mes codes
          </Link>
        </div>
      </div>
    );
  }

  if (alreadyEnabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">La double authentification est déjà active sur ce compte.</p>
        <Link href="/admin" className={buttonVariants({ className: "h-10 w-full" })}>
          Aller au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <CodeInput allowBackup={false} />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>Activer la double authentification</SubmitButton>
    </form>
  );
}
