import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { absoluteUrl, localizedPath } from "@/lib/seo";
import { getPublishedAlbums, getPublishedPosts } from "@/server/content/blog";
import { getPublishedProjects } from "@/server/content/queries";

export const dynamic = "force-dynamic";

const STATIC_PAGES = ["/", "/a-propos", "/projets", "/services", "/blog", "/galerie", "/devis", "/contact", "/mentions-legales", "/confidentialite"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [projects, posts, albums] = await Promise.all([getPublishedProjects(), getPublishedPosts(), getPublishedAlbums()]);
  const entry = (href: Parameters<typeof localizedPath>[0], lastModified?: string | null) => ({
    url: absoluteUrl(localizedPath(href, routing.defaultLocale)),
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((locale) => [locale, absoluteUrl(localizedPath(href, locale))])),
    },
  });
  return [
    ...STATIC_PAGES.map((href) => entry(href)),
    ...projects.map((project) => entry({ pathname: "/projets/[slug]", params: { slug: project.slug } }, project.publishedAt)),
    ...posts.map((post) => entry({ pathname: "/blog/[slug]", params: { slug: post.slug } }, post.publishedAt)),
    ...albums.map((album) => entry({ pathname: "/galerie/[slug]", params: { slug: album.slug } }, album.eventDate)),
  ];
}
