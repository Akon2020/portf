import { cn } from "@/lib/utils";

/** Numbered editorial label: "01 · Profil". */
export function SectionLabel({ number, label, className }: { number?: string; label: string; className?: string }) {
  return (
    <p className={cn("label-mono flex items-center gap-3 border-t pt-4 text-muted-foreground", className)}>
      {number && <span className="text-accent">{number}</span>}
      {number && <span aria-hidden="true">·</span>}
      <span>{label}</span>
    </p>
  );
}

export function SectionTitle({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return <Tag className={cn("max-w-3xl text-(length:--text-h2) font-medium", className)}>{children}</Tag>;
}

/** Numbers visible sections in order so hidden sections never leave a gap. */
export function sectionNumbers<T extends string>(keys: T[]): Record<T, string> {
  return Object.fromEntries(keys.map((key, index) => [key, String(index + 1).padStart(2, "0")])) as Record<T, string>;
}
