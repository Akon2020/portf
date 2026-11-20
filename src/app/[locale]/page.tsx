import { ArrowDownRight, ArrowRight, ArrowUpRight, Code2, GraduationCap, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactCta } from "@/components/public/contact-cta";
import { JourneyTimeline } from "@/components/public/journey-timeline";
import { JsonLd } from "@/components/public/json-ld";
import { MediaImage } from "@/components/public/media-image";
import { ProjectCard } from "@/components/public/project-card";
import { SectionLabel, SectionTitle, sectionNumbers } from "@/components/public/section-heading";
import { SkillsGrid } from "@/components/public/skills-grid";
import { SocialLinks } from "@/components/public/social-links";
import { StatsRow } from "@/components/public/stats-row";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { NBSP } from "@/lib/typography";
import { pageMetadata } from "@/lib/seo";
import { personJsonLd } from "@/server/content/person";
import {
  getApprovedTestimonials,
  getJourney,
  getMediaById,
  getPublishedProjects,
  getServices,
  getSetting,
  getSkills,
  getSocialLinks,
  getStats,
} from "@/server/content/queries";

const SERVICE_ICONS: Record<string, typeof Code2> = {
  code: Code2,
  smartphone: Smartphone,
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
  "graduation-cap": GraduationCap,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const [profile, t] = await Promise.all([getSetting("profile"), getTranslations({ locale, namespace: "meta" })]);
  return {
    ...pageMetadata({ locale, href: "/", title: `${profile.name} | ${tr(profile.title, locale)}`, description: t("description") }),
    title: { absolute: `${profile.name} | ${tr(profile.title, locale)}` },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, profile, stats, socials, services, projects, journey, skills, testimonials, person] = await Promise.all([
    getTranslations(),
    getSetting("profile"),
    getStats(),
    getSocialLinks(),
    getServices(),
    getPublishedProjects(),
    getJourney(),
    getSkills(),
    getApprovedTestimonials(),
    personJsonLd(locale),
  ]);
  const portrait = await getMediaById(profile.portraitMediaId);
  const featured = (projects.some((project) => project.isFeatured) ? projects.filter((project) => project.isFeatured) : projects).slice(0, 4);
  const organizations = [...new Set(journey.map((item) => item.organization.split(" / ").at(-1)!))];
  const linkedin = socials.find((link) => link.platform === "linkedin");

  const visible = [
    "profile",
    services.length > 0 && "expertise",
    featured.length > 0 && "projects",
    journey.length > 0 && "journey",
    skills.length > 0 && "stack",
    testimonials.length > 0 && "testimonials",
    "contact",
  ].filter(Boolean) as ("profile" | "expertise" | "projects" | "journey" | "stack" | "testimonials" | "contact")[];
  const n = sectionNumbers(visible);

  return (
    <>
      <JsonLd data={person} />

      {/* Hero */}
      <section className="container-site grid items-center gap-12 pb-16 pt-12 md:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          <p className="label-mono flex flex-wrap items-center gap-x-3 gap-y-2 text-muted-foreground">
            <span className="text-accent">{tr(profile.title, locale)}</span>
            <span aria-hidden="true">·</span>
            <span>{tr(profile.location, locale)}</span>
          </p>
          <h1 className="mt-6 text-(length:--text-hero) font-medium leading-[0.98]">{tr(profile.heroHeading, locale)}</h1>
          <p className="mt-6 max-w-xl text-(length:--text-body) text-muted-foreground">{tr(profile.heroIntro, locale)}</p>
          {profile.available && (
            <p className="mt-6 inline-flex items-center gap-2.5 rounded-full border bg-card px-3.5 py-1.5 text-sm">
              <span className="relative flex size-2" aria-hidden="true">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-green opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-2 rounded-full bg-brand-green" />
              </span>
              {tr(profile.availabilityLabel, locale)}
            </p>
          )}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/devis"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              {t("hero.ctaPrimary")}
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/projets" className="inline-flex h-12 items-center gap-2 rounded-full border px-6 text-sm font-medium hover:bg-surface">
              {t("hero.ctaSecondary")}
              <ArrowDownRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <SocialLinks links={socials} className="mt-8" />
          <div className="mt-10">
            <StatsRow stats={stats.map((stat) => ({ ...stat, label: tr(stat.label, locale) }))} />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute inset-x-6 -bottom-6 top-10 -rotate-3 rounded-[2rem] border border-brand-orange/40"
          />
          <div className="relative aspect-[4/5] overflow-hidden rounded-[999px_999px_24px_24px] border bg-surface shadow-xl">
            {portrait && (
              <MediaImage
                media={portrait}
                locale={locale}
                alt={t("hero.portraitAlt")}
                priority
                sizes="(min-width: 1024px) 460px, 90vw"
                className="size-full object-cover object-top"
              />
            )}
          </div>
          <div className="absolute -left-2 top-8 -rotate-6 rounded-lg border bg-card px-4 py-3 shadow-md">
            <p className="label-mono text-accent">{t("hero.since")}</p>
            <p className="font-heading text-2xl font-medium">{profile.foundedYear}</p>
          </div>
          <div className="absolute -right-2 bottom-10 rounded-lg border bg-card px-4 py-3 shadow-md">
            <p className="text-xs text-muted-foreground">{t("hero.basedIn")}</p>
            <p className="font-medium">{tr(profile.location, locale)}</p>
          </div>
        </div>
      </section>

      {/* Organizations */}
      {organizations.length > 0 && (
        <section aria-label={t("home.trustLabel")} className="border-y bg-surface/50 py-6">
          <p className="sr-only">{t("home.trustLabel")}</p>
          <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
            <ul className="flex w-max animate-marquee gap-14 motion-reduce:animate-none motion-reduce:flex-wrap motion-reduce:justify-center">
              {[...organizations, ...organizations].map((name, index) => (
                <li
                  key={`${name}-${index}`}
                  aria-hidden={index >= organizations.length}
                  className="whitespace-nowrap font-heading text-xl text-muted-foreground grayscale"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Profile */}
      <section className="container-site mt-24" aria-labelledby="profil">
        <SectionLabel number={n.profile} label={t("sections.profile")} />
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <SectionTitle>
            <span id="profil">{tr(profile.profileHeading, locale)}</span>
          </SectionTitle>
          <div>
            <p className="text-(length:--text-body) text-muted-foreground">{tr(profile.profileText, locale)}</p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm font-medium">
              <Link href="/a-propos" className="inline-flex items-center gap-1.5 border-b border-accent pb-1 hover:text-accent">
                {t("home.profileMore")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {linkedin && (
                <a
                  href={linkedin.url}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="inline-flex items-center gap-1.5 border-b pb-1 hover:text-accent"
                >
                  LinkedIn
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Expertise and services */}
      {services.length > 0 && (
        <section className="mt-24 bg-surface/60 py-20" aria-labelledby="expertise">
          <div className="container-site">
            <SectionLabel number={n.expertise} label={t("sections.expertise")} />
            <div className="mt-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <SectionTitle>
                <span id="expertise">{t("home.expertiseTitle")}</span>
              </SectionTitle>
              <Link href="/services" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium hover:text-accent">
                {t("home.allServices")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border md:grid-cols-2 lg:grid-cols-3">
              {services.slice(0, 6).map((service, index) => {
                const Icon = SERVICE_ICONS[service.icon ?? ""] ?? Code2;
                return (
                  <li key={service.id} className="flex flex-col bg-background p-7">
                    <div className="flex items-start justify-between">
                      <Icon className="size-6 text-accent" aria-hidden="true" />
                      <span className="label-mono text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <h3 className="mt-10 text-(length:--text-h3) font-medium">{tr(service.title, locale)}</h3>
                    <p className="mt-3 flex-1 text-muted-foreground">{tr(service.description, locale)}</p>
                    <Link
                      href={{ pathname: "/devis", query: { service: service.slug } }}
                      className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                    >
                      {t("home.serviceCta")}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
              {services.slice(0, 6).length % 3 !== 0 && (
                <li className="flex flex-col justify-between bg-background p-7 lg:col-span-1">
                  <p className="font-heading text-(length:--text-h3) font-medium">{t("home.otherNeed")}</p>
                  <Link href="/devis" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                    {t("hero.ctaPrimary")}
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* Featured projects */}
      {featured.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="projets">
          <SectionLabel number={n.projects} label={t("sections.projects")} />
          <div className="mt-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle>
              <span id="projets">{t("home.projectsTitle")}</span>
            </SectionTitle>
            <Link href="/projets" className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium hover:text-accent">
              {t("home.allProjects")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((project, index) => (
              <ProjectCard key={project.id} project={project} locale={locale} index={index} />
            ))}
          </div>
        </section>
      )}

      {/* Journey */}
      {journey.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="parcours">
          <SectionLabel number={n.journey} label={t("sections.journey")} />
          <SectionTitle className="mt-10">
            <span id="parcours">{t("home.journeyTitle")}</span>
          </SectionTitle>
          <div className="mt-12">
            <JourneyTimeline items={journey} />
          </div>
        </section>
      )}

      {/* Stack */}
      {skills.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="stack">
          <SectionLabel number={n.stack} label={t("sections.stack")} />
          <SectionTitle className="mt-10">
            <span id="stack">{t("home.stackTitle")}</span>
          </SectionTitle>
          <div className="mt-12">
            <SkillsGrid skills={skills} />
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="temoignages">
          <SectionLabel number={n.testimonials} label={t("sections.testimonials")} />
          <SectionTitle className="mt-10">
            <span id="temoignages">{t("home.testimonialsTitle")}</span>
          </SectionTitle>
          <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((item) => (
              <li key={item.id}>
                <figure className="flex h-full flex-col rounded-xl border bg-card p-7">
                  <blockquote className="flex-1 font-heading text-xl leading-snug">{locale === "fr" ? `«${NBSP}${tr(item.quote, locale)}${NBSP}»` : `“${tr(item.quote, locale)}”`}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    {item.photo && (
                      <MediaImage media={item.photo} locale={locale} sizes="48px" className="size-12 rounded-full object-cover" />
                    )}
                    <span>
                      <span className="block font-medium">
                        {item.authorUrl ? (
                          <a href={item.authorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                            {item.authorName}
                          </a>
                        ) : (
                          item.authorName
                        )}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {[tr(item.authorRole, locale), item.authorCompany].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ContactCta locale={locale} number={n.contact} />
    </>
  );
}
