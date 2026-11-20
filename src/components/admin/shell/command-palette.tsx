"use client";

import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ALL_NAV_ITEMS, QUICK_ACTIONS } from "./nav-config";

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Ctrl or Cmd + K: jump to any section or quick action with the keyboard. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => {
    const all = [
      ...ALL_NAV_ITEMS.map((item) => ({ href: item.href, label: item.label, group: "Aller à" })),
      ...QUICK_ACTIONS.map((item) => ({ ...item, group: "Actions" })),
    ];
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return all.filter((entry) => words.every((word) => normalize(entry.label).includes(word)));
  }, [query]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Recherche rapide" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-4">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={input}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((value) => Math.min(value + 1, entries.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((value) => Math.max(value - 1, 0));
              } else if (event.key === "Enter" && entries[index]) {
                event.preventDefault();
                go(entries[index].href);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Aller à une page ou lancer une action"
            aria-label="Rechercher une page ou une action"
            aria-controls="palette-results"
            aria-activedescendant={entries[index] ? `palette-${index}` : undefined}
            className="h-14 flex-1 bg-transparent text-sm outline-none"
          />
          <kbd className="rounded-md border bg-surface px-1.5 font-mono text-[10px] text-muted-foreground">Échap</kbd>
        </div>
        <ul id="palette-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {entries.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun résultat.</li>}
          {entries.map((entry, position) => (
            <li
              key={`${entry.group}-${entry.href}`}
              id={`palette-${position}`}
              role="option"
              aria-selected={position === index}
              onMouseEnter={() => setIndex(position)}
              onClick={() => go(entry.href)}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm",
                position === index ? "bg-accent text-accent-foreground" : "text-foreground",
              )}
            >
              <ArrowRight className="size-4 shrink-0 opacity-70" aria-hidden="true" />
              <span className="flex-1">{entry.label}</span>
              <span className={cn("text-xs", position === index ? "text-accent-foreground/80" : "text-muted-foreground")}>{entry.group}</span>
              {position === index && <CornerDownLeft className="size-3.5" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
