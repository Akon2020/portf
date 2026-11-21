import { Plus } from "lucide-react";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import type { LocalizedText } from "@/server/db/schema";

export type FaqEntry = { id: string; category: LocalizedText; question: LocalizedText; answer: LocalizedText };

/** Accordion of questions, native details elements so it works without JavaScript. */
export function FaqList({ items, locale, grouped = false }: { items: FaqEntry[]; locale: Locale; grouped?: boolean }) {
  const groups = new Map<string, FaqEntry[]>();
  for (const item of items) {
    const key = grouped ? tr(item.category, locale) : "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return (
    <div className="space-y-10">
      {[...groups.entries()].map(([category, entries]) => (
        <div key={category || "all"}>
          {category && <h3 className="label-mono mb-3 text-accent">{category}</h3>}
          <ul className="divide-y rounded-2xl border bg-card">
            {entries.map((item) => (
              <li key={item.id}>
                <details className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    <span>{tr(item.question, locale)}</span>
                    <Plus className="size-5 shrink-0 text-accent transition-transform group-open:rotate-45 motion-reduce:transition-none" aria-hidden="true" />
                  </summary>
                  <p className="pb-5 leading-relaxed text-muted-foreground">{tr(item.answer, locale)}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
