"use client";

import { Copy, Loader2, Trash2 } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/utils";

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-surface text-muted-foreground",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
    danger: "bg-destructive/12 text-destructive",
    info: "bg-info/12 text-info",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

/** Destructive action with a native confirmation, so it also works on mobile. */
export function ConfirmButton({
  action,
  confirmText,
  label,
  variant = "danger",
}: {
  action: () => Promise<unknown>;
  confirmText: string;
  label: string;
  variant?: "danger" | "neutral";
}) {
  const [pending, start] = useTransition();
  const Icon = variant === "danger" ? Trash2 : Copy;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (window.confirm(confirmText)) start(() => void action());
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm disabled:opacity-50",
        variant === "danger" ? "text-destructive hover:bg-destructive/10" : "hover:bg-surface",
      )}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
      {label}
    </button>
  );
}

export function ActionButton({ action, label, className }: { action: () => Promise<unknown>; label: string; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => void action())}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs hover:bg-surface disabled:opacity-50", className)}
    >
      {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      {label}
    </button>
  );
}
