import { ArrowUpRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ContactCta } from "@/components/public/contact-cta";
import { SectionLabel, SectionTitle } from "@/components/public/section-heading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { getServices } from "@/server/content/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return pageMetadata({ locale, href: "/services", title: t("title"), description: t("intro") });
}

export default async function ServicesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, format, services] = await Promise.all([getTranslations("services"), getFormatter(), getServices()]);
  const steps = ["1", "2", "3", "4"] as const;

  return (
    <>
      <section className="container-site pt-16 md:pt-24">
        <SectionLabel label={t("title")} />
        <h1 className="mt-8 max-w-3xl text-(length:--text-hero) font-medium leading-[0.98]">{t("title")}</h1>
        <p className="mt-6 max-w-2xl text-(length:--text-body) text-muted-foreground">{t("intro")}</p>

        <ul className="mt-16 space-y-6">
          {services.map((service, index) => (
            <li
              key={service.id}
              id={service.slug}
              className="grid scroll-mt-24 gap-8 rounded-2xl border bg-card p-7 md:grid-cols-[80px_1fr_1fr] md:p-10"
            >
              <p className="label-mono text-accent">{String(index + 1).padStart(2, "0")}</p>
              <div>
                <h2 className="text-(length:--text-h3) font-medium">{tr(service.title, locale)}</h2>
                <p className="mt-3 text-muted-foreground">{tr(service.description, locale)}</p>
                {service.startingPrice !== null && (
                  <p className="mt-5 text-sm">
                    <span className="text-muted-foreground">{t("from")} </span>
                    <span className="font-heading text-2xl font-medium">
                      {format.number(service.startingPrice / 100, { style: "currency", currency: service.currency, maximumFractionDigits: 0 })}
                    </span>
                  </p>
                )}
                <Link href="/contact" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                  {t("cta")}
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              {service.deliverables.length > 0 && (
                <div>
                  <h3 className="label-mono text-muted-foreground">{t("deliverables")}</h3>
                  <ul className="mt-4 space-y-2.5">
                    {service.deliverables.map((item, position) => (
                      <li key={position} className="flex gap-2.5">
                        <Check className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
                        <span>{tr(item, locale)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="container-site mt-24" aria-labelledby="processus">
        <SectionLabel number="02" label={t("processTitle")} />
        <SectionTitle className="mt-10">
          <span id="processus">{t("processTitle")}</span>
        </SectionTitle>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step} className="bg-background p-7">
              <p className="label-mono text-accent">{`0${step}`}</p>
              <h3 className="mt-6 text-(length:--text-h3) font-medium">{t(`process.${step}.title`)}</h3>
              <p className="mt-3 text-muted-foreground">{t(`process.${step}.text`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <ContactCta locale={locale} />
    </>
  );
}
