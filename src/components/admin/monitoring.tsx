"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState } from "react";
import { cn } from "@/lib/utils";
import type { MonitoringFormState } from "@/server/actions/monitoring";

const TABS = [
  { href: "/admin/monitoring", label: "Audience" },
  { href: "/admin/monitoring/securite", label: "Sécurité" },
  { href: "/admin/monitoring/bannissements", label: "Bannissements" },
  { href: "/admin/monitoring/journaux", label: "Journaux" },
];

export function MonitoringTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections du monitoring" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex gap-1 rounded-xl border bg-card p-1">
        {TABS.map((tab) => {
          const active = tab.href === "/admin/monitoring" ? pathname === tab.href : pathname.startsWith(tab.href) || (tab.href.endsWith("securite") && pathname.startsWith("/admin/monitoring/ip"));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn("inline-flex h-9 items-center whitespace-nowrap rounded-lg px-3.5 text-sm", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

type Action = (state: MonitoringFormState, formData: FormData) => Promise<MonitoringFormState>;
const inputClass = "h-10 w-full rounded-lg border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function Feedback({ state }: { state: MonitoringFormState }) {
  if (!state.message) return null;
  return (
    <p role="status" className={state.ok ? "flex items-center gap-1.5 text-sm text-success" : "text-sm text-destructive"}>
      {state.ok && <CheckCircle2 className="size-4" aria-hidden="true" />}
      {state.message}
    </p>
  );
}

export function BanForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3" key={state.ok ? state.message : "form"}>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_160px]">
        <label className="space-y-1 text-xs font-medium">
          IP ou plage CIDR
          <input name="ip" required placeholder="203.0.113.7 ou 203.0.113.0/24" className={`${inputClass} font-mono`} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Motif
          <input name="reason" maxLength={300} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Durée
          <select name="hours" defaultValue="24" className={inputClass}>
            <option value="1">1 heure</option>
            <option value="24">24 heures</option>
            <option value="168">7 jours</option>
            <option value="720">30 jours</option>
            <option value="0">Permanent</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-destructive px-4 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Bannir
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function AllowForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3" key={state.ok ? state.message : "form"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium">
          IP ou plage CIDR
          <input name="ip" required className={`${inputClass} font-mono`} />
        </label>
        <label className="space-y-1 text-xs font-medium">
          Libellé
          <input name="label" maxLength={120} placeholder="Bureau, serveur de monitoring..." className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium hover:bg-surface disabled:opacity-60">
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Autoriser
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

/** Horizontal bar list, readable on phones. */
export function BarList({ rows, emptyLabel = "Aucune donnée." }: { rows: { label: string; value: number; href?: string }[]; emptyLabel?: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.label} className="relative overflow-hidden rounded-lg">
          <span aria-hidden="true" className="absolute inset-y-0 left-0 rounded-lg bg-accent/12" style={{ width: `${(row.value / max) * 100}%` }} />
          <span className="relative flex items-center justify-between gap-3 px-2.5 py-1.5 text-sm">
            {row.href ? (
              <Link href={row.href} className="min-w-0 truncate font-mono text-xs hover:text-accent">
                {row.label}
              </Link>
            ) : (
              <span className="min-w-0 truncate">{row.label}</span>
            )}
            <span className="shrink-0 font-medium tabular-nums">{row.value.toLocaleString("fr-FR")}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
