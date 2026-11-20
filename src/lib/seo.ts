import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { getSiteUrl } from "./site";

type Href = Parameters<typeof getPathname>[0]["href"];

export function absoluteUrl(path: string): string {
  return new URL(path, getSiteUrl()).toString();
}

/** Localized path of an internal route, for example /projets/x or /en/projects/x. */
export function localizedPath(href: Href, locale: Locale): string {
  return getPathname({ href, locale });
}

/** Canonical URL and hreflang alternates for a page available in both languages. */
export function alternatesFor(href: Href, locale: Locale): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const other of routing.locales) languages[other] = absoluteUrl(localizedPath(href, other));
  languages["x-default"] = absoluteUrl(localizedPath(href, routing.defaultLocale));
  return { canonical: absoluteUrl(localizedPath(href, locale)), languages };
}

export function pageMetadata(options: {
  locale: Locale;
  href: Href;
  title: string;
  description: string;
  image?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(localizedPath(options.href, options.locale));
  return {
    title: options.title,
    description: options.description,
    alternates: alternatesFor(options.href, options.locale),
    robots: options.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: options.title,
      description: options.description,
      url,
      type: options.type ?? "website",
      locale: options.locale === "fr" ? "fr_FR" : "en_US",
      alternateLocale: options.locale === "fr" ? ["en_US"] : ["fr_FR"],
      siteName: "Isaac Akonkwa",
      ...(options.image ? { images: [{ url: options.image, width: 1200, height: 630 }] } : {}),
    },
    twitter: { card: "summary_large_image", creator: "@akon1703", title: options.title, description: options.description },
  };
}
