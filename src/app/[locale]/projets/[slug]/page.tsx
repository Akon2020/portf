import { ArrowLeft, ArrowRight, ArrowUpRight, Code2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ContactCta } from "@/components/public/contact-cta";
import { JsonLd } from "@/components/public/json-ld";
import { MediaImage } from "@/components/public/media-image";
import { ProjectGallery } from "@/components/public/project-gallery";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPeriod } from "@/lib/format";
import { paragraphs, tr } from "@/lib/localized";
import { absoluteUrl, localizedPath, pageMetadata } from "@/lib/seo";
import { getProjectDetail } from "@/server/content/queries";

type Params = Promise<{ locale: Locale; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const detail = await getProjectDetail(slug);
  if (!detail) return {};
  const { project } = detail;
  return pageMetadata({
    locale,
    href: { pathname: "/projets/[slug]", params: { slug } },
    title: tr(project.seoTitle, locale) || tr(project.title, locale),
    description: tr(project.seoDescription, locale) || tr(project.summary, locale),
    type: "article",
  });
}

function Prose({ text }: { text: string }) {
  return (
    <div className="prose-site max-w-2xl text-(length:--text-body) text-muted-foreground">
      {paragraphs(text).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const detail = await getProjectDetail(slug);
  if (!detail) notFound();
  const t = await getTranslations("project");
  const { project, gallery, testimonial, previous, next } = detail;
  const title = tr(project.title, locale);
  const href = { pathname: "/projets/[slug]", params: { slug } } as const;

  const sections = [
    { key: "problem", text: tr(project.problem, locale) },
    { key: "objective", text: tr(project.objective, locale) },
    { key: "role", text: tr(project.role, locale) },
    { key: "context", text: tr(project.body, locale) },
  ].filter((section) => section.text);

  const period = project.startedAt ? formatPeriod(project.startedAt, project.endedAt, locale) : null;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            name: title,
            description: tr(project.summary, locale),
            url: absoluteUrl(localizedPath(href, locale)),
            inLanguage: locale,
            author: { "@type": "Person", name: "Isaac Akonkwa" },
            keywords: project.techStack.join(", "),
            image: project.cover ? absoluteUrl(project.cover.srcSet.at(-1)?.url ?? project.cover.url) : undefined,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Isaac Akonkwa", item: absoluteUrl(localizedPath("/", locale)) },
              { "@type": "ListItem", position: 2, name: t("back"), item: absoluteUrl(localizedPath("/projets", locale)) },
              { "@type": "ListItem", position: 3, name: title, item: absoluteUrl(localizedPath(href, locale)) },
            ],
          },
        ]}
      />

      <article>
        <header className="container-site pt-12 md:pt-20">
          <Link href="/projets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Link>
          <p className="label-mono mt-10 text-accent">
            {project.categories.map((category) => t(`categories.${category}`)).join(" · ")}
          </p>
          <h1 className="mt-4 max-w-4xl text-(length:--text-hero) font-medium leading-[0.98]">{title}</h1>
          <p className="mt-6 max-w-2xl text-(length:--text-body) text-muted-foreground">{tr(project.summary, locale)}</p>

          <dl className="mt-10 grid grid-cols-2 gap-6 border-t pt-6 text-sm md:grid-cols-4">
            <div>
              <dt className="label-mono text-muted-foreground">{t("type")}</dt>
              <dd className="mt-1">{project.confidential ? t("confidential") : t(`projectType.${project.projectType}`)}</dd>
            </div>
            <div>
              <dt className="label-mono text-muted-foreground">{t("stageLabel")}</dt>
              <dd className="mt-1">{t(`stage.${project.stage}`)}</dd>
            </div>
            {period && (
              <div>
                <dt className="label-mono text-muted-foreground">{t("period")}</dt>
                <dd className="mt-1">{period}</dd>
              </div>
            )}
            {project.clientName && (
              <div>
                <dt className="label-mono text-muted-foreground">Client</dt>
                <dd className="mt-1">{project.clientName}</dd>
              </div>
            )}
          </dl>

          {(project.demoUrl || project.repoUrl) && (
            <div className="mt-8 flex flex-wrap gap-3">
              {project.demoUrl && (
                <a
                  href={project.demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground"
                >
                  {t("demo")}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              )}
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-full border px-5 text-sm font-medium hover:bg-surface"
                >
                  <Code2 className="size-4" aria-hidden="true" />
                  {t("code")}
                </a>
              )}
            </div>
          )}
        </header>

        {project.cover && (
          <div className="container-site mt-12">
            <MediaImage
              media={project.cover}
              locale={locale}
              priority
              sizes="(min-width: 1200px) 1180px, 100vw"
              className="aspect-[16/9] w-full rounded-2xl border object-cover"
            />
          </div>
        )}

        <div className="container-site mt-16 grid gap-14 lg:grid-cols-[1fr_320px]">
          <div className="space-y-14">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`section-${section.key}`}>
                <h2 id={`section-${section.key}`} className="text-(length:--text-h3) font-medium">
                  {t(section.key)}
                </h2>
                <div className="mt-4">
                  <Prose text={section.text} />
                </div>
              </section>
            ))}

            {project.results.length > 0 && (
              <section aria-labelledby="section-results">
                <h2 id="section-results" className="text-(length:--text-h3) font-medium">
                  {t("results")}
                </h2>
                <dl className="mt-6 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
                  {project.results.map((metric, index) => (
                    <div key={index} className="flex flex-col-reverse gap-1 bg-background p-6">
                      <dt className="text-sm text-muted-foreground">{tr(metric.label, locale)}</dt>
                      <dd className="font-heading text-4xl font-medium">{metric.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {gallery.length > 0 && (
              <section aria-labelledby="section-gallery">
                <h2 id="section-gallery" className="text-(length:--text-h3) font-medium">
                  {t("gallery")}
                </h2>
                <div className="mt-6">
                  <ProjectGallery
                    items={gallery.map(({ media, caption }) => ({
                      id: media.id,
                      src: media.srcSet.at(-1)?.url ?? media.url,
                      srcSet: media.srcSet.map((variant) => `${variant.url} ${variant.width}w`).join(", "),
                      width: media.width,
                      height: media.height,
                      alt: tr(media.alt, locale) || title,
                      caption: tr(caption, locale),
                      blur: media.blurDataUrl,
                    }))}
                  />
                </div>
              </section>
            )}

            {testimonial && (
              <figure className="rounded-2xl border bg-card p-8">
                <blockquote className="font-heading text-2xl leading-snug">{tr(testimonial.quote, locale)}</blockquote>
                <figcaption className="mt-6 text-sm">
                  <span className="font-medium">{testimonial.authorName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {[tr(testimonial.authorRole, locale), testimonial.authorCompany].filter(Boolean).join(", ")}
                  </span>
                </figcaption>
              </figure>
            )}
          </div>

          {project.techStack.length > 0 && (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="label-mono text-muted-foreground">{t("stack")}</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {project.techStack.map((tech) => (
                  <li key={tech} className="rounded-full border bg-card px-3 py-1 font-mono text-xs">
                    {tech}
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>

        {(previous || next) && (
          <nav aria-label={t("back")} className="container-site mt-20 grid gap-4 border-t pt-8 sm:grid-cols-2">
            {previous && (
              <Link
                href={{ pathname: "/projets/[slug]", params: { slug: previous.slug } }}
                className="group rounded-xl border p-6 hover:bg-surface"
              >
                <span className="label-mono inline-flex items-center gap-1.5 text-muted-foreground">
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  {t("previous")}
                </span>
                <span className="mt-2 block font-heading text-xl">{tr(previous.title, locale)}</span>
              </Link>
            )}
            {next && (
              <Link
                href={{ pathname: "/projets/[slug]", params: { slug: next.slug } }}
                className="group rounded-xl border p-6 text-right hover:bg-surface sm:col-start-2"
              >
                <span className="label-mono inline-flex items-center gap-1.5 text-muted-foreground">
                  {t("next")}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
                <span className="mt-2 block font-heading text-xl">{tr(next.title, locale)}</span>
              </Link>
            )}
          </nav>
        )}
      </article>

      <ContactCta locale={locale} />
    </>
  );
}
