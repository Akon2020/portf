import { cn } from "@/lib/utils";

const MONOGRAMS: Record<string, string> = {
  github: "GH",
  linkedin: "IN",
  x: "X",
  instagram: "IG",
  facebook: "FB",
  whatsapp: "WA",
  email: "@",
  calendly: "CAL",
  youtube: "YT",
  tiktok: "TT",
  other: "WWW",
};

export interface SocialLinkItem {
  id: string;
  platform: string;
  label: string;
  url: string;
}

/** Social links shown as monospace monograms, consistent with the editorial labels. */
export function SocialLinks({ links, className, size = "md" }: { links: SocialLinkItem[]; className?: string; size?: "sm" | "md" }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {links.map((link) => {
        const external = link.url.startsWith("http");
        return (
          <li key={link.id}>
            <a
              href={link.url}
              title={link.label}
              {...(external ? { target: "_blank", rel: "noopener noreferrer me" } : {})}
              className={cn(
                "grid place-items-center rounded-full border font-mono text-[11px] font-medium tracking-wide text-muted-foreground transition-colors hover:border-accent hover:text-accent",
                size === "sm" ? "size-8" : "size-10",
              )}
            >
              {MONOGRAMS[link.platform] ?? MONOGRAMS.other}
              <span className="sr-only"> ({link.label})</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
