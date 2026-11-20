import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LegalPage } from "@/components/public/legal-page";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { DEFAULT_PRIVACY_POLICY } from "@/server/content/legal-defaults";
import { getSetting } from "@/server/content/queries";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "legal" });
  return pageMetadata({ locale, href: "/confidentialite", title: t("privacyTitle"), description: t("privacyTitle") });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, legal] = await Promise.all([getTranslations("legal"), getSetting("legal")]);
  const text = tr(legal.privacyPolicy, locale) || tr(DEFAULT_PRIVACY_POLICY, locale);
  return <LegalPage title={t("privacyTitle")} text={text} />;
}
