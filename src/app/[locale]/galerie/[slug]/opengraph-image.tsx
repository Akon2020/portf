import { OG_SIZE, ogCard } from "@/lib/og";
import { tr } from "@/lib/localized";
import { getAlbumBySlug } from "@/server/content/blog";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Isaac Akonkwa, galerie";

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const data = await getAlbumBySlug(slug);
  return ogCard({
    eyebrow: locale === "fr" ? "Galerie" : "Gallery",
    title: data ? tr(data.album.title, locale) : "Isaac Akonkwa",
    footer: data ? [data.album.location, `${data.items.length} photos`].filter(Boolean).join(" · ") : "",
  });
}
