"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarCheck,
  FileText,
  FolderKanban,
  Images,
  Inbox,
  LayoutDashboard,
  Newspaper,
  Receipt,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const ADMIN_NAV = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard, ready: true },
  { href: "/admin/contenu", label: "Contenu", icon: FolderKanban, ready: false },
  { href: "/admin/blog", label: "Blog", icon: Newspaper, ready: false },
  { href: "/admin/galerie", label: "Galerie", icon: Images, ready: false },
  { href: "/admin/messagerie", label: "Messagerie", icon: Inbox, ready: false },
  { href: "/admin/devis", label: "Devis", icon: FileText, ready: false },
  { href: "/admin/clients", label: "Clients", icon: Users, ready: false },
  { href: "/admin/taches", label: "Tâches et agenda", icon: CalendarCheck, ready: false },
  { href: "/admin/facturation", label: "Facturation", icon: Receipt, ready: false },
  { href: "/admin/monitoring", label: "Monitoring", icon: Activity, ready: false },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings, ready: false },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'administration" className="flex gap-1 overflow-x-auto lg:flex-col">
      {ADMIN_NAV.map(({ href, label, icon: Icon, ready }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const className = cn(
          "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          !ready && "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground",
        );
        if (!ready) {
          return (
            <span key={href} className={className} aria-disabled="true" title="Disponible dans une prochaine phase">
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </span>
          );
        }
        return (
          <Link key={href} href={href} className={className} aria-current={active ? "page" : undefined}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
