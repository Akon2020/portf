import { Download } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactCta } from "@/components/public/contact-cta";
import { JourneyTimeline } from "@/components/public/journey-timeline";
import { JsonLd } from "@/components/public/json-ld";
import { MediaImage } from "@/components/public/media-image";
import { SectionLabel, SectionTitle } from "@/components/public/section-heading";
import { SkillsGrid } from "@/components/public/skills-grid";
import type { Locale } from "@/i18n/routing";
import { paragraphs, tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { personJsonLd } from "@/server/content/person";
import { getJourney, getMediaById, getSetting, getSkills } from "@/server/content/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, profile] = await Promise.all([getTranslations({ locale, namespace: "about" }), getSetting("profile")]);
  return pageMetadata({ locale, href: "/a-propos", title: t("title"), description: tr(profile.tagline, locale) });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, profile, cv, journey, skills, person] = await Promise.all([
    getTranslations("about"),
    getSetting("profile"),
    getSetting("cv"),
    getJourney(),
    getSkills(),
    personJsonLd(locale),
  ]);
  const [portrait, cvFile] = await Promise.all([
    getMediaById(profile.portraitMediaId),
    getMediaById((locale === "en" ? cv.enMediaId : null) ?? cv.frMediaId),
  ]);
  const bio = tr(profile.bioLong, locale) || tr(profile.profileText, locale);

  return (
    <>
      <JsonLd data={person} />
      <section className="container-site grid gap-12 pt-16 md:pt-24 lg:grid-cols-[1.2fr_0.8fr] lg:gap-20">
        <div>
          <SectionLabel label={t("title")} />
          <h1 className="mt-8 text-(length:--text-hero) font-medium leading-[0.98]">{tr(profile.profileHeading, locale)}</h1>
          <div className="prose-site mt-8 max-w-2xl text-(length:--text-body) text-muted-foreground">
            {paragraphs(bio).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <dl className="mt-10 grid max-w-xl grid-cols-2 gap-6 border-t pt-6 text-sm">
            <div>
              <dt className="label-mono text-muted-foreground">{t("location")}</dt>
              <dd className="mt-1">{tr(profile.location, locale)}</dd>
            </div>
            <div>
              <dt className="label-mono text-muted-foreground">Akon Tech</dt>
              <dd className="mt-1">{profile.foundedYear}</dd>
            </div>
          </dl>
          {cvFile && (
            <a
              href={cvFile.url}
              download
              data-track="cv_download"
              data-track-label={locale}
              className="mt-10 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground"
            >
              <Download className="size-4" aria-hidden="true" />
              {t("cv")}
            </a>
          )}
        </div>
        {portrait && (
          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            <MediaImage
              media={portrait}
              locale={locale}
              priority
              sizes="(min-width: 1024px) 420px, 90vw"
              className="aspect-[4/5] w-full rounded-2xl border object-cover object-top"
            />
          </div>
        )}
      </section>

      {profile.values.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="valeurs">
          <SectionLabel number="01" label={t("values")} />
          <ul className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {profile.values.map((value, index) => (
              <li key={index} className="bg-background p-7">
                <p className="label-mono text-accent">{String(index + 1).padStart(2, "0")}</p>
                <h2 id={index === 0 ? "valeurs" : undefined} className="mt-6 text-(length:--text-h3) font-medium">
                  {tr(value.title, locale)}
                </h2>
                <p className="mt-3 text-muted-foreground">{tr(value.text, locale)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {journey.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="parcours">
          <SectionLabel number="02" label={t("journey")} />
          <SectionTitle className="mt-10">
            <span id="parcours">{t("journey")}</span>
          </SectionTitle>
          <div className="mt-12">
            <JourneyTimeline items={journey} />
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="competences">
          <SectionLabel number="03" label={t("skills")} />
          <SectionTitle className="mt-10">
            <span id="competences">{t("skills")}</span>
          </SectionTitle>
          <div className="mt-12">
            <SkillsGrid skills={skills} />
          </div>
        </section>
      )}

      <ContactCta locale={locale} />
    </>
  );
}
