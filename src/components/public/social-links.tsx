import { Globe, Mail } from "lucide-react";
import { siCalendly, siFacebook, siGithub, siInstagram, siLinkedin, siTiktok, siWhatsapp, siX, siYoutube, type SimpleIcon } from "simple-icons";
import { cn } from "@/lib/utils";

/** Official brand marks (Simple Icons, CC0), rendered in the current text color. */
const BRANDS: Record<string, SimpleIcon> = {
  github: siGithub,
  linkedin: siLinkedin,
  x: siX,
  instagram: siInstagram,
  facebook: siFacebook,
  whatsapp: siWhatsapp,
  calendly: siCalendly,
  youtube: siYoutube,
  tiktok: siTiktok,
};

export function BrandIcon({ platform, className }: { platform: string; className?: string }) {
  const brand = BRANDS[platform];
  if (platform === "email") return <Mail className={className} aria-hidden="true" />;
  if (!brand) return <Globe className={className} aria-hidden="true" />;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="currentColor">
      <path d={brand.path} />
    </svg>
  );
}

export interface SocialLinkItem {
  id: string;
  platform: string;
  label: string;
  url: string;
}

/** Social links as round icon buttons, with the brand color on hover. */
export function SocialLinks({ links, className, size = "md" }: { links: SocialLinkItem[]; className?: string; size?: "sm" | "md" }) {
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {links.map((link) => {
        const external = link.url.startsWith("http");
        const brand = BRANDS[link.platform];
        return (
          <li key={link.id}>
            <a
              href={link.url}
              title={link.label}
              {...(external ? { target: "_blank", rel: "noopener noreferrer me" } : {})}
              style={brand ? ({ "--brand": `#${brand.hex}` } as React.CSSProperties) : undefined}
              className={cn(
                "grid place-items-center rounded-full border text-muted-foreground transition-colors hover:border-[var(--brand,var(--accent))] hover:text-[var(--brand,var(--accent))] dark:hover:text-foreground",
                size === "sm" ? "size-9" : "size-10",
              )}
            >
              <BrandIcon platform={link.platform} className={size === "sm" ? "size-4" : "size-[18px]"} />
              <span className="sr-only">{link.label}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
