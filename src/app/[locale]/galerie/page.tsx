import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactCta } from "@/components/public/contact-cta";
import { MediaImage } from "@/components/public/media-image";
import { SectionLabel } from "@/components/public/section-heading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { getPublishedAlbums } from "@/server/content/blog";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "gallery" });
  return pageMetadata({ locale, href: "/galerie", title: t("title"), description: t("intro") });
}

function formatAlbumDate(value: string | null, locale: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export default async function GalleryPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, albums] = await Promise.all([getTranslations("gallery"), getPublishedAlbums()]);

  return (
    <>
      <section className="container-site pt-16 md:pt-24">
        <SectionLabel label={t("title")} />
        <h1 className="mt-8 max-w-3xl text-(length:--text-hero) font-medium leading-[0.98]">{t("title")}</h1>
        <p className="mt-6 max-w-2xl text-(length:--text-body) text-muted-foreground">{t("intro")}</p>

        {albums.length === 0 ? (
          <p className="mt-14 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {albums.map((album) => (
              <li key={album.id}>
                <article className="group relative overflow-hidden rounded-2xl border bg-card">
                  {album.cover ? (
                    <MediaImage
                      media={album.cover}
                      locale={locale}
                      alt=""
                      sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div aria-hidden="true" className="aspect-[4/3] w-full bg-surface" />
                  )}
                  <div className="p-5">
                    <p className="label-mono flex flex-wrap gap-x-2 text-muted-foreground">
                      {[formatAlbumDate(album.eventDate, locale), album.location].filter(Boolean).join(" · ")}
                    </p>
                    <h2 className="mt-2 font-heading text-xl font-medium">
                      <Link href={{ pathname: "/galerie/[slug]", params: { slug: album.slug } }} className="after:absolute after:inset-0">
                        {tr(album.title, locale)}
                      </Link>
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t("photos", { count: album.count })}</p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
      <ContactCta locale={locale} />
    </>
  );
}
