import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactCta } from "@/components/public/contact-cta";
import { ProjectCard } from "@/components/public/project-card";
import { ProjectsExplorer } from "@/components/public/projects-explorer";
import { SectionLabel } from "@/components/public/section-heading";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { getPublishedProjects } from "@/server/content/queries";

const FILTERS = ["web", "mobile", "ai", "security", "saas", "backend"];

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "projects" });
  return pageMetadata({ locale, href: "/projets", title: t("title"), description: t("intro") });
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, projects] = await Promise.all([getTranslations("projects"), getPublishedProjects()]);
  const categories = FILTERS.filter((category) => projects.some((project) => project.categories.includes(category as never)));

  return (
    <>
      <section className="container-site pt-16 md:pt-24">
        <SectionLabel label={t("title")} />
        <h1 className="mt-8 max-w-3xl text-(length:--text-hero) font-medium leading-[0.98]">{t("title")}</h1>
        <p className="mt-6 max-w-2xl text-(length:--text-body) text-muted-foreground">{t("intro")}</p>
        <div className="mt-14">
          <ProjectsExplorer
            categories={categories}
            items={projects.map((project) => ({
              id: project.id,
              categories: project.categories,
              searchText: normalize(
                [tr(project.title, locale), tr(project.summary, locale), ...project.techStack].join(" "),
              ),
            }))}
          >
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} locale={locale} headingLevel={2} />
            ))}
          </ProjectsExplorer>
        </div>
      </section>
      <ContactCta locale={locale} />
    </>
  );
}
