"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/espace-client", label: "Mon espace", exact: true },
  { href: "/galerie", label: "Galerie" },
  { href: "/projets", label: "Réalisations" },
  { href: "/", label: "Le site" },
];

/** Portal navigation: the client space, plus the gallery and the public site. */
export function PortalNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'espace client" className="border-t">
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4">
        {LINKS.map((link) => {
          const active = link.exact ? pathname === link.href || pathname.startsWith(`${link.href}/projets`) : false;
          return (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 items-center border-b-2 px-3 text-sm transition-colors",
                  active ? "border-accent font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
