import {
  Activity,
  CalendarCheck,
  FileText,
  FolderKanban,
  Images,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key of the counter shown as a badge. */
  badge?: "messages" | "quotes" | "review" | "tasks" | "invoices";
  /** Available in a later version: shown disabled. */
  soon?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/admin/a-valider", label: "À valider", icon: ListChecks, badge: "review" },
    ],
  },
  {
    label: "Activité",
    items: [
      { href: "/admin/messagerie", label: "Messagerie", icon: Inbox, badge: "messages" },
      { href: "/admin/devis", label: "Devis", icon: FileText, badge: "quotes" },
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/facturation", label: "Facturation", icon: Receipt, badge: "invoices" },
      { href: "/admin/taches", label: "Tâches et agenda", icon: CalendarCheck, badge: "tasks" },
    ],
  },
  {
    label: "Contenu",
    items: [
      { href: "/admin/contenu", label: "Contenu du site", icon: FolderKanban },
      { href: "/admin/blog", label: "Blog", icon: Newspaper },
      { href: "/admin/galerie", label: "Galerie", icon: Images },
    ],
  },
  {
    label: "Système",
    items: [
      { href: "/admin/monitoring", label: "Monitoring", icon: Activity },
      { href: "/admin/parametres", label: "Paramètres", icon: Settings },
      { href: "/admin/securite", label: "Sécurité du compte", icon: ShieldCheck },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function currentTitle(pathname: string): string {
  const match = [...ALL_NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find((item) => isActive(pathname, item.href));
  return match?.label ?? "Administration";
}

/** Quick actions offered in the command palette. */
export const QUICK_ACTIONS = [
  { href: "/admin/contenu/projets/nouveau", label: "Nouveau projet" },
  { href: "/admin/blog/nouveau", label: "Nouvel article" },
  { href: "/admin/devis/emis/nouveau", label: "Nouveau devis" },
  { href: "/admin/galerie/nouveau", label: "Nouvel album" },
  { href: "/admin/contenu/medias", label: "Envoyer des médias" },
  { href: "/admin/contenu/pages", label: "Modifier les textes du site" },
];
