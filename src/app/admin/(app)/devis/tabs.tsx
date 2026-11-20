"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function QuoteTabs() {
  const pathname = usePathname();
  const issued = pathname.startsWith("/admin/devis/emis");
  const tabs = [
    { href: "/admin/devis", label: "Demandes reçues", active: !issued },
    { href: "/admin/devis/emis", label: "Devis émis", active: issued },
  ];
  return (
    <nav aria-label="Devis" className="mb-6 flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "border-b-2 px-3 py-2 text-sm",
            tab.active ? "border-accent font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
