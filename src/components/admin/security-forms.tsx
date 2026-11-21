"use client";

import { CheckCircle2, Copy, Download, Loader2 } from "lucide-react";
import { useActionState, useState } from "react";
import { PasswordInput } from "@/components/ui/password-input";
import type { SecurityFormState } from "@/server/actions/security";
import { authInputClass } from "./auth-forms";

type Action = (state: SecurityFormState, formData: FormData) => Promise<SecurityFormState>;

function Submit({ pending, children, tone = "accent" }: { pending: boolean; children: React.ReactNode; tone?: "accent" | "danger" }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        tone === "danger"
          ? "inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/40 bg-card px-4 text-sm font-medium text-destructive hover:bg-destructive/5 disabled:opacity-60"
          : "inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:opacity-60"
      }
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

function Feedback({ state }: { state: SecurityFormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.message && !state.backupCodes)
    return (
      <p role="status" className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="size-4" aria-hidden="true" /> {state.message}
      </p>
    );
  return null;
}

/** Displays freshly generated backup codes, once. */
export function BackupCodes({ codes, message }: { codes: string[]; message?: string }) {
  const [copied, setCopied] = useState(false);
  const content = `Codes de secours (usage unique)\n\n${codes.join("\n")}\n`;
  return (
    <div className="space-y-4 rounded-xl border border-success/40 bg-success/5 p-4" role="status">
      {message && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden="true" /> {message}
        </p>
      )}
      <p className="text-sm">
        Conservez ces codes en lieu sûr : chacun permet une connexion sans téléphone. Ils ne seront plus jamais affichés.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm sm:grid-cols-5">
        {codes.map((code) => (
          <li key={code} className="rounded-lg border bg-card px-2 py-1.5 text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(content);
            setCopied(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface"
        >
          <Copy className="size-3.5" aria-hidden="true" /> {copied ? "Copiés" : "Copier"}
        </button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(content)}`}
          download="codes-de-secours.txt"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-xs font-medium hover:bg-surface"
        >
          <Download className="size-3.5" aria-hidden="true" /> Télécharger
        </a>
      </div>
    </div>
  );
}

export function EnrollForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok && state.backupCodes) return <BackupCodes codes={state.backupCodes} message={state.message} />;
  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <label htmlFor="enroll-code" className="text-sm font-medium">
          Code à 6 chiffres
        </label>
        <input
          id="enroll-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          className={`${authInputClass} w-40 font-mono tracking-widest`}
        />
      </div>
      <Submit pending={pending}>Activer</Submit>
      <div className="sm:pb-2">
        <Feedback state={state} />
      </div>
    </form>
  );
}

function IdentityFields({ prefix, withCode }: { prefix: string; withCode: boolean }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor={`${prefix}-password`} className="text-sm font-medium">
          Mot de passe actuel
        </label>
        <PasswordInput id={`${prefix}-password`} name="password" autoComplete="current-password" required />
      </div>
      {withCode && (
        <div className="space-y-1.5">
          <label htmlFor={`${prefix}-code`} className="text-sm font-medium">
            Code TOTP ou code de secours
          </label>
          <input id={`${prefix}-code`} name="code" autoComplete="one-time-code" required maxLength={24} className={`${authInputClass} font-mono`} />
        </div>
      )}
    </div>
  );
}

export function RegenerateCodesForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      {state.ok && state.backupCodes ? <BackupCodes codes={state.backupCodes} message={state.message} /> : <IdentityFields prefix="regen" withCode />}
      {!state.backupCodes && (
        <div className="flex flex-wrap items-center gap-3">
          <Submit pending={pending}>Générer de nouveaux codes</Submit>
          <Feedback state={state} />
        </div>
      )}
    </form>
  );
}

export function DisableTotpForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <IdentityFields prefix="disable" withCode />
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending} tone="danger">
          Désactiver la double authentification
        </Submit>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ChangePasswordForm({ action, withCode }: { action: Action; withCode: boolean }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3" key={state.ok ? "done" : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="pw-current" className="text-sm font-medium">
            Mot de passe actuel
          </label>
          <PasswordInput id="pw-current" name="current" autoComplete="current-password" required />
        </div>
        {withCode && (
          <div className="space-y-1.5">
            <label htmlFor="pw-code" className="text-sm font-medium">
              Code TOTP ou code de secours
            </label>
            <input id="pw-code" name="code" autoComplete="one-time-code" required maxLength={24} className={`${authInputClass} font-mono`} />
          </div>
        )}
        <div className="space-y-1.5">
          <label htmlFor="pw-next" className="text-sm font-medium">
            Nouveau mot de passe
          </label>
          <PasswordInput id="pw-next" name="next" autoComplete="new-password" minLength={12} required aria-describedby="pw-hint" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="pw-confirmation" className="text-sm font-medium">
            Confirmation
          </label>
          <PasswordInput id="pw-confirmation" name="confirmation" autoComplete="new-password" minLength={12} required />
        </div>
      </div>
      <p id="pw-hint" className="text-xs text-muted-foreground">
        12 caractères minimum. Une phrase de passe de plusieurs mots est idéale.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Submit pending={pending}>Changer le mot de passe</Submit>
        <Feedback state={state} />
      </div>
    </form>
  );
}
