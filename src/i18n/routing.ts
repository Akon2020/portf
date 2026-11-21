import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // French without prefix, English under /en.
  localePrefix: "as-needed",
  // The language is chosen by the visitor, never guessed from the browser.
  localeDetection: false,
  pathnames: {
    "/": "/",
    "/a-propos": { fr: "/a-propos", en: "/about" },
    "/projets": { fr: "/projets", en: "/projects" },
    "/projets/[slug]": { fr: "/projets/[slug]", en: "/projects/[slug]" },
    "/services": "/services",
    "/contact": "/contact",
    "/devis": { fr: "/devis", en: "/quote" },
    "/blog": "/blog",
    "/blog/[slug]": "/blog/[slug]",
    "/galerie": { fr: "/galerie", en: "/gallery" },
    "/galerie/[slug]": { fr: "/galerie/[slug]", en: "/gallery/[slug]" },
    "/mentions-legales": { fr: "/mentions-legales", en: "/legal" },
    "/confidentialite": { fr: "/confidentialite", en: "/privacy" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type AppPathname = keyof typeof routing.pathnames;
