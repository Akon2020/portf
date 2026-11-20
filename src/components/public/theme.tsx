"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme-script";

type ThemeChoice = "light" | "dark" | "system";

function apply(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const [choice, setChoice] = useState<ThemeChoice>("system");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeChoice | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with storage after hydration
      if (stored) setChoice(stored);
    } catch {
      // Storage unavailable: keep the system theme.
    }
  }, []);

  const order: ThemeChoice[] = ["system", "light", "dark"];
  const next = order[(order.indexOf(choice) + 1) % order.length];
  const Icon = choice === "dark" ? Moon : choice === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={() => {
        setChoice(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Ignore storage errors.
        }
        apply(next);
      }}
      className="grid size-9 place-items-center rounded-full border text-foreground transition-colors hover:bg-surface"
      aria-label={`${t("toggle")} (${t(choice)})`}
      title={t(choice)}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
