import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";
import { THEME_SCRIPT } from "@/lib/theme-script";
import { routing } from "@/i18n/routing";
import { fontVariables } from "@/lib/fonts";
import { tr } from "@/lib/localized";
import { getSiteUrl } from "@/lib/site";
import { getSetting } from "@/server/content/queries";
import "../globals.css";

// Content comes from the database at request time (cached by tags), so the
// build never needs access to the production database.
export const dynamic = "force-dynamic";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F0E8" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1626" },
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const [t, profile] = await Promise.all([getTranslations({ locale, namespace: "meta" }), getSetting("profile")]);
  const title = `${profile.name} | ${tr(profile.title, locale)}`;
  return {
    metadataBase: getSiteUrl(),
    title: { default: title, template: `%s | ${profile.name}` },
    description: t("description"),
    applicationName: profile.name,
    authors: [{ name: profile.name }],
    creator: profile.name,
    formatDetection: { telephone: false },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const profile = await getSetting("profile");

  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <NextIntlClientProvider>
          <SiteHeader name={profile.name} />
          <main id="contenu" tabIndex={-1} className="outline-none">
            {children}
          </main>
          <SiteFooter locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
