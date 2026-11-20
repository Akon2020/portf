"use client";

import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type FieldErrors = Record<string, string | undefined>;

const inputClass =
  "w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  name,
  label,
  defaultValue,
  errors,
  hint,
  required,
  type = "text",
  placeholder,
  className,
  inputMode,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null;
  errors?: FieldErrors;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  className?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = useId();
  const error = errors?.[name];
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={!!error}
        className={cn(inputClass, "h-10")}
      />
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  defaultValue,
  errors,
  hint,
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  errors?: FieldErrors;
  hint?: string;
  rows?: number;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={errors?.[name]} hint={hint}>
      <textarea id={id} name={name} rows={rows} defaultValue={defaultValue ?? ""} aria-invalid={!!errors?.[name]} className={inputClass} />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  options,
  defaultValue,
  errors,
  hint,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  errors?: FieldErrors;
  hint?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} error={errors?.[name]} hint={hint}>
      <select id={id} name={name} defaultValue={defaultValue ?? options[0]?.value} className={cn(inputClass, "h-10")}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Hidden "0" then checkbox "1": unchecked boxes are still submitted. */
export function CheckboxField({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input type="hidden" name={name} value="0" />
      <input id={id} type="checkbox" name={name} value="1" defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-[var(--accent)]" />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </label>
    </div>
  );
}

export function CheckboxGroup({
  name,
  label,
  options,
  defaultValue = [],
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <input type="hidden" name={`${name}[]`} value="" />
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground">
            <input type="checkbox" name={`${name}[]`} value={option.value} defaultChecked={defaultValue.includes(option.value)} className="sr-only" />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type Localized = { fr?: string; en?: string } | null | undefined;

/** French and English side by side, with a live "translation missing" badge. */
export function LocalizedField({
  name,
  label,
  defaultValue,
  errors,
  multiline = false,
  rows = 4,
  required,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: Localized;
  errors?: FieldErrors;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const [fr, setFr] = useState(defaultValue?.fr ?? "");
  const [en, setEn] = useState(defaultValue?.en ?? "");
  const missing = fr.trim() !== "" && en.trim() === "";
  const error = errors?.[`${name}.fr`] ?? errors?.[name];

  const control = (lang: "fr" | "en", value: string, onChange: (value: string) => void) => {
    const props = {
      id: `${id}-${lang}`,
      name: `${name}.${lang}`,
      value,
      lang,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
      "aria-invalid": lang === "fr" && !!error,
      className: cn(inputClass, !multiline && "h-10"),
    };
    return multiline ? <textarea rows={rows} {...props} /> : <input type="text" {...props} />;
  };

  return (
    <fieldset className="space-y-1.5">
      <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium">
        <span>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </span>
        {missing && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-normal text-warning">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Traduction manquante
          </span>
        )}
      </legend>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor={`${id}-fr`} className="label-mono mb-1 block text-[10px] text-muted-foreground">
            FR
          </label>
          {control("fr", fr, setFr)}
        </div>
        <div>
          <label htmlFor={`${id}-en`} className="label-mono mb-1 block text-[10px] text-muted-foreground">
            EN (facultatif)
          </label>
          {control("en", en, setEn)}
        </div>
      </div>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Repeated rows of localized text, optionally with a short value (metrics). */
export function LocalizedListField({
  name,
  label,
  defaultValue = [],
  withValue = false,
  valueLabel = "Valeur",
  itemLabel = "Élément",
}: {
  name: string;
  label: string;
  defaultValue?: { label?: Localized; value?: string; fr?: string; en?: string }[];
  withValue?: boolean;
  valueLabel?: string;
  itemLabel?: string;
}) {
  const [rows, setRows] = useState(() =>
    defaultValue.map((row, index) => ({ key: index, ...row })),
  );
  const [nextKey, setNextKey] = useState(defaultValue.length);
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{label}</legend>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Aucun élément.</p>}
      {rows.map((row, index) => {
        const text = withValue ? row.label : { fr: row.fr, en: row.en };
        const prefix = withValue ? `${name}[${index}].label` : `${name}[${index}]`;
        return (
          <div key={row.key} className="grid gap-2 rounded-lg border bg-card/50 p-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            {withValue && (
              <div className="md:col-span-3">
                <label className="label-mono mb-1 block text-[10px] text-muted-foreground" htmlFor={`${name}-${row.key}-value`}>
                  {valueLabel}
                </label>
                <input id={`${name}-${row.key}-value`} name={`${name}[${index}].value`} defaultValue={row.value ?? ""} className={cn(inputClass, "h-10 md:w-48")} />
              </div>
            )}
            <div>
              <label className="label-mono mb-1 block text-[10px] text-muted-foreground" htmlFor={`${name}-${row.key}-fr`}>
                {itemLabel} FR
              </label>
              <input id={`${name}-${row.key}-fr`} name={`${prefix}.fr`} defaultValue={text?.fr ?? ""} className={cn(inputClass, "h-10")} />
            </div>
            <div>
              <label className="label-mono mb-1 block text-[10px] text-muted-foreground" htmlFor={`${name}-${row.key}-en`}>
                {itemLabel} EN
              </label>
              <input id={`${name}-${row.key}-en`} name={`${prefix}.en`} defaultValue={text?.en ?? ""} className={cn(inputClass, "h-10")} />
            </div>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              className="grid h-10 w-10 place-items-center rounded-lg border text-muted-foreground hover:text-destructive"
              aria-label={`Supprimer ${itemLabel.toLowerCase()} ${index + 1}`}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => {
          setRows((current) => [...current, { key: nextKey }]);
          setNextKey((value) => value + 1);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm hover:bg-surface"
      >
        <Plus className="size-4" aria-hidden="true" />
        Ajouter
      </button>
    </fieldset>
  );
}
