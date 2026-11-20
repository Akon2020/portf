"use client";

import Script from "next/script";
import { useId } from "react";
import { cn } from "@/lib/utils";

export const publicInputClass =
  "w-full rounded-xl border bg-card px-4 py-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";

export function PublicField({
  label,
  error,
  hint,
  required,
  children,
  htmlFor,
  className,
}: {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  htmlFor: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required && <span aria-hidden="true" className="text-accent"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${htmlFor}-hint`} className="text-sm text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/** Invisible field filled only by bots. */
export function Honeypot() {
  const id = useId();
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor={id}>Website</label>
      <input id={id} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

/** Cloudflare Turnstile widget, rendered only when a site key is configured. */
export function Turnstile({ siteKey, locale }: { siteKey: string | null; locale: string }) {
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-language={locale} data-theme="auto" />
    </>
  );
}
