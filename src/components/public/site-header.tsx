"use client";

import { ArrowRight, Menu, Send, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import NextLink from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ThemeMenu } from "@/components/theme-menu";
import { Avatar } from "@/components/ui/avatar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/a-propos", key: "about" },
  { href: "/projets", key: "projects" },
  { href: "/services", key: "services" },
  { href: "/blog", key: "blog" },
  { href: "/galerie", key: "gallery" },
  { href: "/contact", key: "contact" },
] as const;

function LocaleSwitch() {
  const locale = useLocale() as Locale;
  const t = useTranslations("locale");
  const pathname = usePathname();
  const params = useParams();
  const router = useRouter();
  const target: Locale = locale === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      lang={target}
      onClick={() =>
        // Same page in the other language, slugs are shared between languages.
        router.replace({ pathname, params } as never, { locale: target, scroll: false })
      }
      className="label-mono grid h-9 min-w-9 place-items-center rounded-full border px-2.5 text-foreground transition-colors hover:bg-surface"
      title={t("switchTo")}
    >
      {target.toUpperCase()}
      <span className="sr-only"> ({t("switchTo")})</span>
    </button>
  );
}

export type HeaderViewer = { kind: "admin" | "client"; name: string; avatarUrl: string | null } | null;

/** Signed in: avatar to the right space. Visitors: link to the client portal. */
function AccountLink({ viewer, className, onClick, full }: { viewer: HeaderViewer; className?: string; onClick?: () => void; full?: boolean }) {
  const t = useTranslations("nav");
  if (viewer) {
    const href = viewer.kind === "admin" ? "/admin" : "/espace-client";
    const label = viewer.kind === "admin" ? t("adminSpace") : t("portal");
    return (
      <NextLink href={href} onClick={onClick} title={`${viewer.name}, ${label}`} className={cn("inline-flex items-center gap-2.5 rounded-full", full && "h-12 justify-center border px-4 text-sm font-medium", className)}>
        <Avatar name={viewer.name} src={viewer.avatarUrl} className="size-8" />
        <span className={full ? "" : "sr-only"}>{full ? label : `${viewer.name}, ${label}`}</span>
      </NextLink>
    );
  }
  return (
    <NextLink href="/espace-client" onClick={onClick} className={cn("items-center gap-1.5 rounded-full border text-sm", full ? "flex h-12 justify-center font-medium" : "h-9 px-3 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground", className)}>
      <UserRound className="size-4" aria-hidden="true" />
      {t("portal")}
    </NextLink>
  );
}

function Logo({ name, onClick, label }: { name: string; onClick?: () => void; label: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label={label} onClick={onClick}>
      <span aria-hidden="true" className="grid size-8 place-items-center rounded-[50%_50%_50%_4px] bg-brand-green font-heading text-lg font-semibold italic text-white">
        A
      </span>
      <span className="text-[13px] font-semibold leading-[1.05] tracking-tight">
        {first}
        <br />
        {rest.join(" ")}
      </span>
    </Link>
  );
}

/** Full screen menu for phones and tablets, rendered in a portal above the page. */
function MobileMenu({ name, viewer, onClose }: { name: string; viewer: HeaderViewer; onClose: () => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panel.current) return;
      // Keeps the keyboard focus inside the open menu.
      const focusable = [...panel.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div ref={panel} id="menu-mobile" role="dialog" aria-modal="true" aria-label={t("main")} className="fixed inset-0 z-[60] flex flex-col bg-background lg:hidden">
      <div className="container-site flex h-16 shrink-0 items-center justify-between gap-4 border-b">
        <Logo name={name} onClick={onClose} label={`${name}, ${t("home")}`} />
        <button type="button" onClick={onClose} aria-label={t("close")} className="grid size-10 place-items-center rounded-full border">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <nav aria-label={t("main")} className="container-site flex-1 overflow-y-auto py-6">
        <ul className="space-y-1">
          {[{ href: "/", key: "home" } as const, ...NAV].map((item, index) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex items-baseline gap-4 border-b py-3.5 font-heading text-[clamp(1.75rem,7vw,2.5rem)] leading-tight", active ? "text-accent" : "text-foreground")}
                >
                  <span className="label-mono w-6 shrink-0 text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="container-site shrink-0 space-y-3 border-t py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Link href="/contact" onClick={onClose} className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          {t("workWithMe")}
          <Send className="size-4" aria-hidden="true" />
        </Link>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/devis" onClick={onClose} className="flex h-12 items-center justify-center gap-2 rounded-full border text-sm font-medium">
            {t("quoteCta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <AccountLink viewer={viewer} onClick={onClose} full />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function SiteHeader({ name, viewer = null }: { name: string; viewer?: HeaderViewer }) {
  const t = useTranslations("nav");
  const theme = useTranslations("theme");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("skip")}
      </a>
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Logo name={name} label={`${name}, ${t("home")}`} />

        <nav aria-label={t("main")} className="hidden lg:block">
          <ul className="flex items-center gap-6 text-sm">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "transition-colors hover:text-foreground",
                      active ? "text-foreground underline decoration-accent decoration-2 underline-offset-8" : "text-muted-foreground",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/contact"
            data-track="cta_click"
            data-track-label="work_with_me_header"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            {t("workWithMe")}
          </Link>
          <AccountLink viewer={viewer} className={viewer ? "" : "hidden lg:inline-flex"} />
          <ThemeMenu labels={{ button: theme("toggle"), light: theme("light"), dark: theme("dark"), system: theme("system") }} />
          <LocaleSwitch />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full border lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-haspopup="dialog"
            aria-label={t("menu")}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {open && <MobileMenu name={name} viewer={viewer} onClose={() => setOpen(false)} />}
    </header>
  );
}
