import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/public/json-ld";
import { ProjectGallery } from "@/components/public/project-gallery";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { paragraphs, tr } from "@/lib/localized";
import { absoluteUrl, localizedPath, pageMetadata } from "@/lib/seo";
import { getAlbumBySlug } from "@/server/content/blog";

type Params = Promise<{ locale: Locale; slug: string }>;

function albumDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const data = await getAlbumBySlug(slug);
  if (!data) return {};
  const t = await getTranslations({ locale, namespace: "gallery" });
  return pageMetadata({
    locale,
    href: { pathname: "/galerie/[slug]", params: { slug } },
    title: `${tr(data.album.title, locale)} | ${t("title")}`,
    description: tr(data.album.description, locale) || t("intro"),
  });
}

export default async function AlbumPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await getAlbumBySlug(slug);
  if (!data) notFound();
  const t = await getTranslations("gallery");
  const { album, items } = data;
  const title = tr(album.title, locale);
  const href = { pathname: "/galerie/[slug]", params: { slug } } as const;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ImageGallery",
          name: title,
          description: tr(album.description, locale),
          url: absoluteUrl(localizedPath(href, locale)),
          dateCreated: album.eventDate ?? undefined,
          locationCreated: album.location ? { "@type": "Place", name: album.location } : undefined,
          image: items.slice(0, 10).map((item) => absoluteUrl(item.media.srcSet.at(-1)?.url ?? item.media.url)),
        }}
      />
      <section className="container-site pt-12 md:pt-20">
        <Link href="/galerie" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("back")}
        </Link>
        <p className="label-mono mt-10 text-accent">{[albumDate(album.eventDate, locale), album.location].filter(Boolean).join(" · ")}</p>
        <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,1.6rem+3vw,4rem)] font-medium leading-[1.02]">{title}</h1>
        <div className="mt-6 max-w-2xl space-y-4 text-(length:--text-body) text-muted-foreground">
          {paragraphs(tr(album.description, locale)).map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        <p className="label-mono mt-6 text-muted-foreground">{t("photos", { count: items.length })}</p>
        <div className="mt-10">
          <ProjectGallery
            variant="masonry"
            items={items.map(({ id, media, caption }) => ({
              id,
              src: media.srcSet.at(-1)?.url ?? media.url,
              srcSet: media.srcSet.map((variant) => `${variant.url} ${variant.width}w`).join(", "),
              width: media.width,
              height: media.height,
              alt: tr(media.alt, locale) || tr(caption, locale) || title,
              caption: tr(caption, locale),
              blur: media.blurDataUrl,
            }))}
          />
        </div>
      </section>
      <div className="h-24" />
    </>
  );
}
