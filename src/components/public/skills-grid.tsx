import { getTranslations } from "next-intl/server";

type Skill = { id: string; name: string; group: string; level: "advanced" | "confirmed" | "intermediate" };

const GROUP_ORDER = ["frontend", "backend", "mobile", "database", "cloud", "ai", "security", "tools"];
const LEVEL_DOTS = { advanced: 3, confirmed: 2, intermediate: 1 } as const;

export async function SkillsGrid({ skills }: { skills: Skill[] }) {
  const t = await getTranslations("skills");
  const groups = GROUP_ORDER.map((group) => ({ group, items: skills.filter((skill) => skill.group === group) })).filter(
    (entry) => entry.items.length > 0,
  );
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(({ group, items }) => {
        const level = items[0].level;
        return (
          <section key={group} className="bg-background p-6" aria-labelledby={`skills-${group}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 id={`skills-${group}`} className="font-sans text-base font-semibold tracking-normal">
                {t(`groups.${group}`)}
              </h3>
              <p className="label-mono flex items-center gap-1.5 text-muted-foreground">
                <span className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3].map((dot) => (
                    <span
                      key={dot}
                      className={dot <= LEVEL_DOTS[level] ? "size-1.5 rounded-full bg-accent" : "size-1.5 rounded-full bg-border"}
                    />
                  ))}
                </span>
                {t(`levels.${level}`)}
              </p>
            </div>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {items.map((skill) => (
                <li key={skill.id} className="rounded-full border px-3 py-1 text-sm">
                  {skill.name}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
