"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface ExplorerItem {
  id: string;
  categories: string[];
  searchText: string;
}

/**
 * Client side filtering of server rendered project cards: the cards stay in
 * the HTML for search engines, only their visibility changes.
 */
export function ProjectsExplorer({
  items,
  categories,
  children,
}: {
  items: ExplorerItem[];
  categories: string[];
  children: React.ReactNode[];
}) {
  const t = useTranslations("projects");
  const tp = useTranslations("project.categories");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const words = query
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .split(/\s+/)
      .filter(Boolean);
    return new Set(
      items
        .filter((item) => category === "all" || item.categories.includes(category))
        .filter((item) => words.every((word) => item.searchText.includes(word)))
        .map((item) => item.id),
    );
  }, [items, category, query]);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="group" aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
          {["all", ...categories].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                category === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-surface",
              )}
            >
              {value === "all" ? t("all") : tp(value)}
            </button>
          ))}
        </div>
        <label className="relative block md:w-72">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="h-10 w-full rounded-full border bg-card pl-10 pr-4 text-sm placeholder:text-muted-foreground"
          />
        </label>
      </div>
      <p className="label-mono mt-6 text-muted-foreground" aria-live="polite">
        {t("count", { count: visible.size })}
      </p>
      <div className="mt-8 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div key={item.id} hidden={!visible.has(item.id)}>
            {children[index]}
          </div>
        ))}
      </div>
      {visible.size === 0 && <p className="mt-8 text-muted-foreground">{t("empty")}</p>}
    </div>
  );
}
