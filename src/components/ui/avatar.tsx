import { cn } from "@/lib/utils";

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/** Round badge with the profile photo, or the initials when there is none. */
export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-2 ring-accent/60 ring-offset-2 ring-offset-background", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={36} height={36} loading="lazy" decoding="async" className="size-full origin-[50%_30%] scale-[1.6] object-cover object-[50%_30%]" />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
