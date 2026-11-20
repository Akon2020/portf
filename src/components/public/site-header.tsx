"use client";

import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme";

const NAV = [
  { href: "/a-propos", key: "about" },
  { href: "/projets", key: "projects" },
  { href: "/services", key: "services" },
  { href: "/blog", key: "blog" },
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

export function SiteHeader({ name }: { name: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const [first, ...rest] = name.split(" ");

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t("skip")}
      </a>
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${name}, ${t("home")}`} onClick={() => setOpen(false)}>
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-[50%_50%_50%_4px] bg-brand-green font-heading text-lg font-semibold italic text-white"
          >
            A
          </span>
          <span className="text-[13px] font-semibold leading-[1.05] tracking-tight">
            {first}
            <br />
            {rest.join(" ")}
          </span>
        </Link>

        <nav aria-label={t("main")} className="hidden md:block">
          <ul className="flex items-center gap-7 text-sm">
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
          <ThemeToggle />
          <LocaleSwitch />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full border md:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? t("close") : t("menu")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav id="menu-mobile" aria-label={t("main")} hidden={!open} className="border-t bg-background md:hidden">
        <ul className="container-site flex flex-col py-3">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="block py-3 text-lg font-medium" onClick={() => setOpen(false)}>
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
