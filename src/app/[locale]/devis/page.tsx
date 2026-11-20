import { Clock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QuoteForm } from "@/components/public/quote-form";
import { SectionLabel } from "@/components/public/section-heading";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { getServices, getSetting } from "@/server/content/queries";
import { createFormToken, turnstileSiteKey } from "@/server/services/anti-spam";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quoteForm" });
  return pageMetadata({ locale, href: "/devis", title: t("title"), description: t("intro") });
}

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { locale } = await params;
  const { service } = await searchParams;
  setRequestLocale(locale);
  const [t, services, contact] = await Promise.all([getTranslations("quoteForm"), getServices(), getSetting("contact")]);

  return (
    <section className="container-site pt-16 md:pt-24">
      <SectionLabel label={t("title")} />
      <div className="mt-8 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div>
          <h1 className="text-(length:--text-hero) font-medium leading-[0.98]">{t("title")}</h1>
          <p className="mt-6 max-w-md text-(length:--text-body) text-muted-foreground">{t("intro")}</p>
          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-2.5">
              <Clock className="size-4 text-accent" aria-hidden="true" />
              {tr(contact.responseTime, locale)}
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-accent" aria-hidden="true" />
              {tr(contact.openTo, locale)}
            </li>
          </ul>
        </div>
        <QuoteForm
          formToken={createFormToken()}
          siteKey={turnstileSiteKey()}
          services={services.map((item) => ({ slug: item.slug, title: tr(item.title, locale) }))}
          initialService={service}
        />
      </div>
    </section>
  );
}
