import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { tr } from "@/lib/localized";
import type { PublicProject } from "@/server/content/queries";
import { MediaImage } from "./media-image";

export async function ProjectCard({ project, locale, index }: { project: PublicProject; locale: string; index?: number }) {
  const t = await getTranslations("project");
  const metric = project.results[0];
  return (
    <article className="group relative flex flex-col">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl border bg-surface">
        {project.cover ? (
          <MediaImage
            media={project.cover}
            locale={locale}
            sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
            className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-end bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--brand-orange)_22%,transparent),transparent_60%),radial-gradient(circle_at_80%_80%,color-mix(in_srgb,var(--brand-green)_18%,transparent),transparent_55%)] p-6">
            <span className="font-heading text-3xl text-foreground/80">{tr(project.title, locale)}</span>
          </div>
        )}
        {typeof index === "number" && (
          <span className="label-mono absolute left-4 top-4 rounded-full bg-background/90 px-2.5 py-1 text-foreground">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="mt-5 flex flex-1 flex-col">
        <p className="label-mono text-accent">
          {project.categories.slice(0, 3).map((category) => t(`categories.${category}`)).join(" · ")}
        </p>
        <h3 className="mt-2 text-(length:--text-h3) font-medium">
          <Link href={{ pathname: "/projets/[slug]", params: { slug: project.slug } }} className="after:absolute after:inset-0">
            {tr(project.title, locale)}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-muted-foreground">{tr(project.summary, locale)}</p>
        {metric && (
          <p className="mt-4 text-sm">
            <span className="font-heading text-xl font-medium">{metric.value}</span>{" "}
            <span className="text-muted-foreground">{tr(metric.label, locale)}</span>
          </p>
        )}
        {project.techStack.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("stack")}>
            {project.techStack.slice(0, 4).map((tech) => (
              <li key={tech} className="rounded-full border px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                {tech}
              </li>
            ))}
          </ul>
        )}
        <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          {t("view")}
          <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}
