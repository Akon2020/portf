"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { formatPeriod, type AppLocale } from "@/lib/format";
import { tr, type LocalizedText } from "@/lib/localized";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  type: "experience" | "education" | "community" | "speaking" | "award";
  organization: string;
  title: LocalizedText;
  description: LocalizedText;
  location: string | null;
  startDate: string;
  endDate: string | null;
  url: string | null;
}

export function JourneyTimeline({ items, showFilters = true }: { items: TimelineItem[]; showFilters?: boolean }) {
  const t = useTranslations("journey");
  const locale = useLocale() as AppLocale;
  const reduceMotion = useReducedMotion();
  const types = (["experience", "education", "community", "speaking", "award"] as const).filter((type) =>
    items.some((item) => item.type === type),
  );
  const [filter, setFilter] = useState<(typeof types)[number] | "all">("all");
  const visible = filter === "all" ? items : items.filter((item) => item.type === filter);

  return (
    <div>
      {showFilters && types.length > 1 && (
        <div role="group" aria-label={t("filterLabel")} className="mb-10 flex flex-wrap gap-2">
          {(["all", ...types] as const).map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={filter === type}
              onClick={() => setFilter(type)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm transition-colors",
                filter === type ? "border-primary bg-primary text-primary-foreground" : "hover:bg-surface",
              )}
            >
              {t(type)}
            </button>
          ))}
        </div>
      )}
      <ol className="relative border-l pl-0">
        {visible.map((item, index) => (
          <motion.li
            key={item.id}
            className="relative grid gap-2 pb-12 pl-8 last:pb-0 md:grid-cols-[180px_1fr] md:gap-8"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: Math.min(index, 4) * 0.05 }}
          >
            <span
              aria-hidden="true"
              className="absolute -left-[5px] top-2 size-[9px] rounded-full bg-brand-orange ring-4 ring-[color-mix(in_srgb,var(--brand-orange)_18%,transparent)]"
            />
            <p className="label-mono pt-1 text-muted-foreground">{formatPeriod(item.startDate, item.endDate, locale)}</p>
            <div>
              <p className="label-mono text-accent">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {item.organization}
                  </a>
                ) : (
                  item.organization
                )}
              </p>
              <h3 className="mt-2 text-(length:--text-h3) font-medium">{tr(item.title, locale)}</h3>
              {tr(item.description, locale) && <p className="mt-2 max-w-2xl text-muted-foreground">{tr(item.description, locale)}</p>}
              {item.location && <p className="mt-2 text-sm text-muted-foreground">{item.location}</p>}
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
