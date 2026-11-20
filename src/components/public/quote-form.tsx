"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Paperclip, Send, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Honeypot, PublicField, Turnstile, publicInputClass } from "./form-fields";

const TYPES = ["showcase_site", "web_app", "mobile_app", "ecommerce", "ai_integration", "security_audit", "training", "other"] as const;
const FEATURES = ["accounts", "payments", "admin", "multilingual", "offline", "notifications", "analytics", "api"] as const;
const BUDGETS = ["lt500", "500_1500", "1500_5000", "5000_15000", "gt15000", "unknown"] as const;
const DEADLINES = ["asap", "1_month", "3_months", "6_months", "flexible"] as const;
const CHANNELS = ["email", "whatsapp", "call"] as const;
const DRAFT_KEY = "quote-draft-v1";

/** Fields per step, used to send the visitor back to the step of a server error. */
const STEP_FIELDS: Record<number, string[]> = {
  1: ["projectType", "services"],
  2: ["description", "features", "featuresOther", "hasDesign", "referenceLinks", "attachments"],
  3: ["budgetRange", "currency", "deadline"],
  4: ["name", "email", "phone", "company", "preferredContact", "consent", "form"],
};

interface Values {
  projectType: string;
  services: string[];
  description: string;
  features: string[];
  featuresOther: string;
  hasDesign: string;
  referenceLinks: string;
  budgetRange: string;
  currency: string;
  deadline: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  preferredContact: string;
  consent: boolean;
}

const EMPTY: Values = {
  projectType: "",
  services: [],
  description: "",
  features: [],
  featuresOther: "",
  hasDesign: "",
  referenceLinks: "",
  budgetRange: "",
  currency: "USD",
  deadline: "",
  name: "",
  email: "",
  phone: "",
  company: "",
  preferredContact: "email",
  consent: false,
};

function Choice({
  name,
  value,
  checked,
  onChange,
  type = "radio",
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  type?: "radio" | "checkbox";
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
        checked ? "border-accent bg-accent/5 font-medium" : "hover:bg-surface",
      )}
    >
      <input type={type} name={name} value={value} checked={checked} onChange={onChange} className="size-4 accent-[var(--accent)]" />
      {children}
    </label>
  );
}

export function QuoteForm({
  formToken,
  siteKey,
  services,
  initialService,
}: {
  formToken: string;
  siteKey: string | null;
  services: { slug: string; title: string }[];
  initialService?: string;
}) {
  const t = useTranslations("quoteForm");
  const te = useTranslations("contactForm.errors");
  const tc = useTranslations("contactForm");
  const locale = useLocale();
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<Values>(() => ({
    ...EMPTY,
    services: initialService && services.some((service) => service.slug === initialService) ? [initialService] : [],
  }));
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [restored, setRestored] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Restore a draft saved in this browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved) as Partial<Values>;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one time restore after hydration
      const hasContent = Boolean(draft.projectType || draft.description?.trim() || draft.name?.trim() || draft.email?.trim());
      if (!hasContent) return;
      setValues((current) => ({ ...current, ...draft, consent: false, services: initialService ? current.services : (draft.services ?? []) }));
      setRestored(true);
    } catch {
      // Storage unavailable or corrupted draft.
    }
  }, [initialService]);

  useEffect(() => {
    if (done) return;
    try {
      const { consent: _consent, ...draft } = values;
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors.
    }
  }, [values, done]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggle = (key: "services" | "features", value: string) =>
    setValues((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value],
    }));

  const goTo = (next: number) => {
    setStep(next);
    requestAnimationFrame(() => heading.current?.focus());
  };

  const validateStep = (current: number): Record<string, string> => {
    const found: Record<string, string> = {};
    if (current === 1 && !values.projectType) found.projectType = te("required");
    if (current === 2) {
      if (values.description.trim().length < 30) found.description = t("errors.min30");
      if (!values.hasDesign) found.hasDesign = te("required");
    }
    if (current === 3) {
      if (!values.budgetRange) found.budgetRange = te("required");
      if (!values.deadline) found.deadline = te("required");
    }
    if (current === 4) {
      if (values.name.trim().length < 2) found.name = te("required");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) found.email = te("email");
      if (!values.consent) found.consent = te("consent");
    }
    return found;
  };

  const next = () => {
    const found = validateStep(step);
    setErrors(found);
    if (Object.keys(found).length === 0) goTo(step + 1);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateStep(4);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const body = new FormData();
    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) value.forEach((item) => body.append(key, item));
      else if (key === "consent") body.append(key, value ? "1" : "");
      else body.append(key, String(value));
    }
    files.forEach((file) => body.append("attachments", file));
    body.append("locale", locale);
    body.append("formToken", formToken);
    const formElement = form.current!;
    body.append("website", (formElement.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "");
    const turnstile = formElement.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
    if (turnstile) body.append("cf-turnstile-response", turnstile.value);

    setSending(true);
    try {
      const response = await fetch("/api/devis", { method: "POST", body });
      const json = (await response.json()) as { ok?: boolean; errors?: Record<string, string> };
      if (json.ok) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {
          // Ignore storage errors.
        }
        setDone(true);
        return;
      }
      const serverErrors = Object.fromEntries(
        Object.entries(json.errors ?? { form: "network" }).map(([field, code]) => [
          field,
          code === "min30" ? t("errors.min30") : code === "network" ? t("errors.network") : te(code),
        ]),
      );
      setErrors(serverErrors);
      const target = Number(Object.entries(STEP_FIELDS).find(([, fields]) => fields.some((field) => field in serverErrors))?.[0] ?? 4);
      goTo(target);
    } catch {
      setErrors({ form: t("errors.network") });
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="rounded-2xl border bg-card p-8">
        <CheckCircle2 className="size-8 text-brand" aria-hidden="true" />
        <h2 className="mt-4 text-(length:--text-h3) font-medium">{t("successTitle")}</h2>
        <p className="mt-2 text-muted-foreground">{t("successText")}</p>
      </div>
    );
  }

  const total = 4;
  return (
    <form ref={form} onSubmit={submit} className="relative rounded-2xl border bg-card/60 p-6 sm:p-8" noValidate>
      <Honeypot />
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 text-sm">
          <p className="label-mono text-muted-foreground">{t("stepOf", { current: step, total })}</p>
          {restored && (
            <p className="text-xs text-muted-foreground">
              {t("draftRestored")}{" "}
              <button
                type="button"
                className="underline underline-offset-4"
                onClick={() => {
                  setValues({ ...EMPTY });
                  setRestored(false);
                  try {
                    localStorage.removeItem(DRAFT_KEY);
                  } catch {
                    // Ignore storage errors.
                  }
                }}
              >
                {t("clearDraft")}
              </button>
            </p>
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={t("stepOf", { current: step, total })}>
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(step / total) * 100}%` }} />
        </div>
        <ol className="mt-3 hidden grid-cols-4 gap-2 text-xs text-muted-foreground sm:grid">
          {[1, 2, 3, 4].map((index) => (
            <li key={index} className={cn(index === step && "font-medium text-foreground")}>
              {t(`steps.${index}`)}
            </li>
          ))}
        </ol>
      </div>

      <h2 ref={heading} tabIndex={-1} className="mb-6 font-sans text-xl font-semibold tracking-normal outline-none">
        {t(`steps.${step}`)}
      </h2>

      {errors.form && (
        <p role="alert" className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {errors.form}
        </p>
      )}

      {step === 1 && (
        <div className="space-y-8">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">{t("projectType")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TYPES.map((type) => (
                <Choice key={type} name="projectType" value={type} checked={values.projectType === type} onChange={() => set("projectType", type)}>
                  {t(`types.${type}`)}
                </Choice>
              ))}
            </div>
            {errors.projectType && <p className="mt-2 text-sm text-destructive" role="alert">{errors.projectType}</p>}
          </fieldset>
          {services.length > 0 && (
            <fieldset>
              <legend className="mb-3 text-sm font-medium">{t("services")}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((service) => (
                  <Choice key={service.slug} type="checkbox" name="services" value={service.slug} checked={values.services.includes(service.slug)} onChange={() => toggle("services", service.slug)}>
                    {service.title}
                  </Choice>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-8">
          <PublicField label={t("description")} htmlFor="description" required error={errors.description} hint={t("descriptionHint")}>
            <textarea id="description" rows={6} value={values.description} onChange={(event) => set("description", event.target.value)} className={publicInputClass} aria-invalid={!!errors.description} />
          </PublicField>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">{t("features")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((feature) => (
                <Choice key={feature} type="checkbox" name="features" value={feature} checked={values.features.includes(feature)} onChange={() => toggle("features", feature)}>
                  {t(`featureList.${feature}`)}
                </Choice>
              ))}
            </div>
          </fieldset>
          <PublicField label={t("featuresOther")} htmlFor="featuresOther" error={errors.featuresOther}>
            <input id="featuresOther" value={values.featuresOther} onChange={(event) => set("featuresOther", event.target.value)} className={publicInputClass} />
          </PublicField>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">
              {t("hasDesign")} <span aria-hidden="true" className="text-accent">*</span>
            </legend>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((option) => (
                <Choice key={option} name="hasDesign" value={option} checked={values.hasDesign === option} onChange={() => set("hasDesign", option)}>
                  {t(option)}
                </Choice>
              ))}
            </div>
            {errors.hasDesign && <p className="mt-2 text-sm text-destructive" role="alert">{errors.hasDesign}</p>}
          </fieldset>
          <PublicField label={t("referenceLinks")} htmlFor="referenceLinks" error={errors.referenceLinks} hint={t("referenceHint")}>
            <textarea id="referenceLinks" rows={3} value={values.referenceLinks} onChange={(event) => set("referenceLinks", event.target.value)} className={publicInputClass} placeholder="https://" />
          </PublicField>
          <PublicField label={t("attachments")} htmlFor="attachments" error={errors.attachments} hint={t("attachmentsHint")}>
            <input
              id="attachments"
              type="file"
              multiple
              accept="application/pdf,image/*"
              onChange={(event) => {
                const list = Array.from(event.target.files ?? []);
                setFiles((current) => [...current, ...list].slice(0, 5));
                event.target.value = "";
              }}
              className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground"
            />
          </PublicField>
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} Mo</span>
                  </span>
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))} aria-label={`${t("remove")} ${file.name}`} className="rounded p-1 hover:bg-surface">
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-8">
          <fieldset>
            <legend className="mb-3 text-sm font-medium">
              {t("budget")} <span aria-hidden="true" className="text-accent">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {BUDGETS.map((budget) => (
                <Choice key={budget} name="budgetRange" value={budget} checked={values.budgetRange === budget} onChange={() => set("budgetRange", budget)}>
                  {t(`budgets.${budget}`)}
                </Choice>
              ))}
            </div>
            {errors.budgetRange && <p className="mt-2 text-sm text-destructive" role="alert">{errors.budgetRange}</p>}
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t("currency")}</legend>
            <p className="mb-3 text-sm text-muted-foreground">{t("currencyHint")}</p>
            <div className="flex gap-2">
              {(["USD", "CDF"] as const).map((currency) => (
                <Choice key={currency} name="currency" value={currency} checked={values.currency === currency} onChange={() => set("currency", currency)}>
                  {currency}
                </Choice>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">
              {t("deadline")} <span aria-hidden="true" className="text-accent">*</span>
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEADLINES.map((deadline) => (
                <Choice key={deadline} name="deadline" value={deadline} checked={values.deadline === deadline} onChange={() => set("deadline", deadline)}>
                  {t(`deadlines.${deadline}`)}
                </Choice>
              ))}
            </div>
            {errors.deadline && <p className="mt-2 text-sm text-destructive" role="alert">{errors.deadline}</p>}
          </fieldset>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <PublicField label={tc("name")} htmlFor="name" required error={errors.name}>
              <input id="name" autoComplete="name" value={values.name} onChange={(event) => set("name", event.target.value)} className={publicInputClass} aria-invalid={!!errors.name} />
            </PublicField>
            <PublicField label={tc("email")} htmlFor="email" required error={errors.email}>
              <input id="email" type="email" autoComplete="email" value={values.email} onChange={(event) => set("email", event.target.value)} className={publicInputClass} aria-invalid={!!errors.email} />
            </PublicField>
            <PublicField label={tc("phone")} htmlFor="phone" error={errors.phone}>
              <input id="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => set("phone", event.target.value)} className={publicInputClass} />
            </PublicField>
            <PublicField label={t("company")} htmlFor="company" error={errors.company}>
              <input id="company" autoComplete="organization" value={values.company} onChange={(event) => set("company", event.target.value)} className={publicInputClass} />
            </PublicField>
          </div>
          <fieldset>
            <legend className="mb-3 text-sm font-medium">{t("preferredContact")}</legend>
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => (
                <Choice key={channel} name="preferredContact" value={channel} checked={values.preferredContact === channel} onChange={() => set("preferredContact", channel)}>
                  {t(`channels.${channel}`)}
                </Choice>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={values.consent} onChange={(event) => set("consent", event.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span>
                {tc("consent")}{" "}
                <Link href="/confidentialite" className="underline underline-offset-4">
                  {tc("privacy")}
                </Link>
              </span>
            </label>
            {errors.consent && <p className="text-sm text-destructive" role="alert">{errors.consent}</p>}
          </div>
          <Turnstile siteKey={siteKey} locale={locale} />
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        {step > 1 ? (
          <button type="button" onClick={() => goTo(step - 1)} className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:bg-surface">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </button>
        ) : (
          <span />
        )}
        {step < total ? (
          <button type="button" onClick={next} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">
            {t("next")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" disabled={sending} className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground disabled:opacity-60">
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            {t("submit")}
          </button>
        )}
      </div>
    </form>
  );
}
