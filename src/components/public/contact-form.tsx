"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { submitContactAction, type PublicFormState } from "@/server/actions/public";
import { Honeypot, PublicField, Turnstile, publicInputClass } from "./form-fields";

const TOPICS = ["project", "collaboration", "recruitment", "mentoring", "other"] as const;

export function ContactForm({ formToken, siteKey, defaultTopic, bare = false }: { formToken: string; siteKey: string | null; defaultTopic?: string; bare?: boolean }) {
  const locale = useLocale() as "fr" | "en";
  const t = useTranslations("contactForm");
  const [state, action, pending] = useActionState<PublicFormState, FormData>(submitContactAction.bind(null, locale), {});
  const [length, setLength] = useState(0);
  const status = useRef<HTMLDivElement>(null);
  const errors = state.errors ?? {};
  const err = (field: string) => (errors[field] ? t(`errors.${errors[field]}`) : undefined);

  useEffect(() => {
    if (state.ok || errors.form) status.current?.focus();
  }, [state, errors.form]);

  if (state.ok) {
    return (
      <div ref={status} tabIndex={-1} role="status" className="rounded-2xl border bg-card p-8 outline-none">
        <CheckCircle2 className="size-8 text-brand" aria-hidden="true" />
        <h2 className="mt-4 text-(length:--text-h3) font-medium">{t("successTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("successText")}</p>
      </div>
    );
  }

  const describedBy = (field: string, hint = false) => (errors[field] ? `${field}-error` : hint ? `${field}-hint` : undefined);

  return (
    <form onSubmit={submitWithoutReset(action)} className={bare ? "relative space-y-6" : "relative space-y-6 rounded-2xl border bg-card/60 p-6 sm:p-8"} noValidate>
      <input type="hidden" name="formToken" value={formToken} />
      <Honeypot />
      {errors.form && (
        <div ref={status} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive outline-none">
          {t(`errors.${errors.form}`)}
        </div>
      )}
      <div className="grid gap-6 sm:grid-cols-2">
        <PublicField label={t("name")} htmlFor="name" required error={err("name")}>
          <input id="name" name="name" autoComplete="name" required maxLength={120} className={publicInputClass} aria-invalid={!!errors.name} aria-describedby={describedBy("name")} />
        </PublicField>
        <PublicField label={t("email")} htmlFor="email" required error={err("email")}>
          <input id="email" name="email" type="email" autoComplete="email" required className={publicInputClass} aria-invalid={!!errors.email} aria-describedby={describedBy("email")} />
        </PublicField>
        <PublicField label={t("phone")} htmlFor="phone" error={err("phone")} hint={t("phoneHint")}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" className={publicInputClass} aria-invalid={!!errors.phone} aria-describedby={describedBy("phone", true)} />
        </PublicField>
        <PublicField label={t("topic")} htmlFor="topic" required error={err("topic")}>
          <select id="topic" name="topic" defaultValue={TOPICS.includes(defaultTopic as never) ? defaultTopic : "project"} className={publicInputClass}>
            {TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {t(`topics.${topic}`)}
              </option>
            ))}
          </select>
        </PublicField>
      </div>
      <PublicField
        label={t("message")}
        htmlFor="message"
        required
        error={err("message")}
        hint={<span aria-live="polite">{t("messageHint", { count: length })}</span>}
      >
        <textarea
          id="message"
          name="message"
          rows={7}
          required
          minLength={50}
          maxLength={5000}
          onChange={(event) => setLength(event.target.value.trim().length)}
          className={publicInputClass}
          aria-invalid={!!errors.message}
          aria-describedby={describedBy("message", true)}
        />
      </PublicField>
      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="consent" value="1" required className="mt-1 size-4 accent-[var(--accent)]" aria-invalid={!!errors.consent} />
          <span>
            {t("consent")}{" "}
            <Link href="/confidentialite" className="underline underline-offset-4">
              {t("privacy")}
            </Link>
          </span>
        </label>
        {errors.consent && (
          <p className="text-sm text-destructive" role="alert">
            {t("errors.consent")}
          </p>
        )}
      </div>
      <Turnstile siteKey={siteKey} locale={locale} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
        {t("submit")}
      </button>
    </form>
  );
}
