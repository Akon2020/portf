"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";

const ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

function applyTheme(choice: ThemeChoice) {
  const dark = choice === "dark" || (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** Theme picker as a small menu: light, dark or the system setting. */
export function ThemeMenu({
  labels,
  className,
  buttonClassName,
}: {
  labels: { button: string; light: string; dark: string; system: string };
  className?: string;
  buttonClassName?: string;
}) {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeChoice | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync with storage after hydration
      if (stored === "light" || stored === "dark" || stored === "system") setChoice(stored);
    } catch {
      // Storage unavailable: the system theme stays.
    }
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    // Follows the operating system while "system" is selected.
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [choice]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    // Focus goes to the selected option when the menu opens.
    root.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"][aria-checked="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (value: ThemeChoice) => {
    setChoice(value);
    setOpen(false);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Ignore storage errors.
    }
    applyTheme(value);
  };

  const Icon = ICONS[choice];
  const options: ThemeChoice[] = ["light", "dark", "system"];

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${labels.button} : ${labels[choice]}`}
        title={labels.button}
        onClick={() => setOpen((value) => !value)}
        className={cn("grid size-9 place-items-center rounded-full border text-foreground transition-colors hover:bg-surface", buttonClassName)}
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={labels.button}
          onKeyDown={(event) => {
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const items = [...(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'))];
            const index = items.indexOf(document.activeElement as HTMLButtonElement);
            items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
          }}
          className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border bg-card p-1 text-sm text-foreground shadow-lg"
        >
          {options.map((value) => {
            const OptionIcon = ICONS[value];
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={choice === value}
                onClick={() => select(value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none hover:bg-surface focus-visible:bg-surface"
              >
                <OptionIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1">{labels[value]}</span>
                {choice === value && <Check className="size-4 text-accent" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
