"use client";

import { ChevronsLeft, ChevronsRight, ExternalLink, LogOut, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeMenu } from "@/components/theme-menu";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/server/actions/auth";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { NAV_GROUPS, currentTitle, isActive, type NavItem } from "./nav-config";

export type Counters = Partial<Record<NonNullable<NavItem["badge"]>, number>>;

interface ShellProps {
  user: { name: string; email: string };
  year: number;
  counters: Counters;
  children: React.ReactNode;
}

const COLLAPSE_KEY = "admin-sidebar-collapsed";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5" aria-label="Tableau de bord">
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[50%_50%_50%_6px] bg-[#16A34A] font-heading text-lg font-semibold italic text-white">
        A
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold">Isaac Akonkwa</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Administration</span>
        </span>
      )}
    </Link>
  );
}

function NavLinks({ counters, compact, onNavigate }: { counters: Counters; compact?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation de l'administration" className="space-y-6">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {compact ? (
            <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden="true" />
          ) : (
            <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const count = item.badge ? (counters[item.badge] ?? 0) : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={compact ? item.label : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      compact && "justify-center px-0",
                      active ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                    {compact ? <span className="sr-only">{item.label}</span> : <span className="flex-1 truncate">{item.label}</span>}
                    {count > 0 && (
                      <span
                        className={cn(
                          "grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                          active ? "bg-accent-foreground/20 text-accent-foreground" : "bg-accent text-accent-foreground",
                          compact && "absolute -right-1 -top-1 min-w-4 px-1 text-[10px]",
                        )}
                      >
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> à traiter</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function UserCard({ user, compact }: { user: ShellProps["user"]; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-surface/60 p-2.5", compact && "flex-col p-2")}>
      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {initials(user.name)}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </span>
      )}
      <form action={logoutAction}>
        <button type="submit" title="Déconnexion" aria-label="Déconnexion" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-destructive">
          <LogOut className="size-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function ThemeButton() {
  return (
    <ThemeMenu
      labels={{ button: "Thème", light: "Clair", dark: "Sombre", system: "Système" }}
      buttonClassName="size-10 rounded-xl bg-card text-muted-foreground hover:text-foreground"
    />
  );
}

export function AdminShell({ user, counters, year, children }: ShellProps) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [palette, setPalette] = useState(false);
  const title = currentTitle(pathname);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the saved preference after hydration
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // Storage unavailable.
    }
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((value) => !value);
      }
      if (event.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
  }, [drawer]);

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      } catch {
        // Storage unavailable.
      }
      return !value;
    });
  };

  return (
    <div className={cn("min-h-dvh lg:grid", collapsed ? "lg:grid-cols-[84px_minmax(0,1fr)]" : "lg:grid-cols-[272px_minmax(0,1fr)]")}>
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-foreground">
        Aller au contenu
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card px-3 py-5 lg:flex">
        <div className={cn("flex items-center justify-between gap-2 px-2", collapsed && "flex-col")}>
          <Logo compact={collapsed} />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavLinks counters={counters} compact={collapsed} />
        </div>
        <UserCard user={user} compact={collapsed} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-5 overflow-y-auto bg-card px-3 py-5 shadow-2xl">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Fermer le menu" className="grid size-9 place-items-center rounded-lg border">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1">
              <NavLinks counters={counters} onNavigate={() => setDrawer(false)} />
            </div>
            <UserCard user={user} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setDrawer(true)} aria-label="Ouvrir le menu" className="grid size-10 place-items-center rounded-xl border bg-card lg:hidden">
              <Menu className="size-[18px]" aria-hidden="true" />
            </button>
            <p className="min-w-0 flex-1 truncate text-lg font-semibold sm:text-xl">{title}</p>
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="hidden h-10 w-64 items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="flex-1 text-left">Rechercher</span>
              <kbd className="rounded-md border bg-surface px-1.5 font-mono text-[10px]">Ctrl K</kbd>
            </button>
            <button type="button" onClick={() => setPalette(true)} aria-label="Rechercher" className="grid size-10 place-items-center rounded-xl border bg-card text-muted-foreground md:hidden">
              <Search className="size-[18px]" aria-hidden="true" />
            </button>
            <NotificationBell />
            <ThemeButton />
            <a
              href="/"
              target="_blank"
              rel="noopener"
              className="hidden h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground sm:inline-flex"
            >
              Voir le site
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </header>
        <main id="admin-main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
        <footer className="border-t px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {year} Isaac Akonkwa · Administration
        </footer>
      </div>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </div>
  );
}
