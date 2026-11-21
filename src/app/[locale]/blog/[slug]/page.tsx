import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/public/json-ld";
import { MediaImage } from "@/components/public/media-image";
import { PostCard, formatPostDate } from "@/components/public/post-card";
import { ShareButtons } from "@/components/public/share-buttons";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { pickLocalized, tr } from "@/lib/localized";
import { absoluteUrl, localizedPath, pageMetadata } from "@/lib/seo";
import { getPostBySlug, relatedPosts } from "@/server/content/blog";
import { getMediaById, getSetting } from "@/server/content/queries";

type Params = Promise<{ locale: Locale; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};
  const title = pickLocalized(post.seoTitle, locale).text || pickLocalized(post.title, locale).text;
  const description = pickLocalized(post.seoDescription, locale).text || pickLocalized(post.excerpt, locale).text;
  const metadata = pageMetadata({ locale, href: { pathname: "/blog/[slug]", params: { slug } }, title, description, type: "article" });
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt, tags: post.tags },
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const post = await getPostBySlug(slug);
  if (!post) notFound();
  const [t, related, profile] = await Promise.all([getTranslations("blog"), relatedPosts(post), getSetting("profile")]);
  const portrait = await getMediaById(profile.portraitMediaId);

  const content = pickLocalized(post.contentHtml, locale);
  const lang = content.lang;
  const title = pickLocalized(post.title, lang).text || pickLocalized(post.title, locale).text;
  const excerpt = pickLocalized(post.excerpt, lang).text;
  const toc = (post.toc[lang] ?? []).filter((entry) => entry.level <= 3);
  const minutes = post.readingMinutes[lang];
  const href = { pathname: "/blog/[slug]", params: { slug } } as const;
  const url = absoluteUrl(localizedPath(href, locale));
  const updated = new Date(post.updatedAt).getTime() - new Date(post.publishedAt).getTime() > 86_400_000;

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: title,
            description: excerpt,
            url,
            inLanguage: lang,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
            author: { "@type": "Person", name: profile.name, url: absoluteUrl(localizedPath("/a-propos", locale)) },
            keywords: post.tags.join(", "),
            articleSection: post.category ?? undefined,
            image: post.cover ? absoluteUrl(post.cover.srcSet.at(-1)?.url ?? post.cover.url) : absoluteUrl(`${localizedPath(href, locale)}/opengraph-image`),
            mainEntityOfPage: url,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: profile.name, item: absoluteUrl(localizedPath("/", locale)) },
              { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl(localizedPath("/blog", locale)) },
              { "@type": "ListItem", position: 3, name: title, item: url },
            ],
          },
        ]}
      />

      <article lang={lang !== locale ? lang : undefined}>
        <header className="container-site pt-12 md:pt-20">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" lang={locale}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("back")}
          </Link>
          <p className="label-mono mt-10 flex flex-wrap gap-x-2 text-muted-foreground" lang={locale}>
            {post.category && (
              <>
                <Link href={{ pathname: "/blog", query: { categorie: post.category } }} className="text-accent hover:underline">
                  {post.category}
                </Link>
                <span aria-hidden="true">·</span>
              </>
            )}
            <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
            {minutes ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{t("readingTime", { minutes })}</span>
              </>
            ) : null}
          </p>
          <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,1.6rem+3vw,4rem)] font-medium leading-[1.02]">{title}</h1>
          {excerpt && <p className="mt-6 max-w-2xl text-(length:--text-body) text-muted-foreground">{excerpt}</p>}
          {lang !== locale && (
            <p lang={locale} className="mt-6 inline-flex rounded-full border border-info/40 bg-info/5 px-4 py-1.5 text-sm text-info">
              {lang === "en" ? t("onlyEnglish") : t("onlyFrench")}
            </p>
          )}
        </header>

        {post.cover && (
          <div className="container-site mt-12">
            <MediaImage media={post.cover} locale={locale} priority sizes="(min-width: 1200px) 1180px, 100vw" className="aspect-[2/1] w-full rounded-2xl border object-cover" />
          </div>
        )}

        <div className="container-site mt-14 grid gap-12 *:min-w-0 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            {toc.length > 2 && (
              <details className="mb-10 rounded-xl border bg-card p-5 lg:hidden" lang={locale}>
                <summary className="cursor-pointer font-medium">{t("toc")}</summary>
                <TocList toc={toc} />
              </details>
            )}
            <div className="rich-content max-w-[70ch]" dangerouslySetInnerHTML={{ __html: content.text }} />

            {post.tags.length > 0 && (
              <ul className="mt-12 flex flex-wrap gap-2" aria-label={t("tags")} lang={locale}>
                {post.tags.map((tag) => (
                  <li key={tag}>
                    <Link href={{ pathname: "/blog", query: { tag } }} className="inline-flex rounded-full border px-3 py-1 font-mono text-xs hover:border-accent hover:text-accent">
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-10 border-t pt-8" lang={locale}>
              <h2 className="label-mono text-muted-foreground">{t("share")}</h2>
              <div className="mt-4">
                <ShareButtons url={url} title={title} />
              </div>
              {updated && <p className="mt-6 text-xs text-muted-foreground">{t("updatedOn", { date: formatPostDate(post.updatedAt, locale) })}</p>}
            </div>

            <aside className="mt-12 flex flex-col gap-5 rounded-2xl border bg-card p-6 sm:flex-row sm:items-center" lang={locale} aria-label={t("authorTitle")}>
              {portrait && <MediaImage media={portrait} locale={locale} sizes="80px" alt="" className="size-20 shrink-0 rounded-full object-cover" />}
              <div>
                <p className="label-mono text-muted-foreground">{t("authorTitle")}</p>
                <p className="mt-1 font-heading text-xl">{profile.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{tr(profile.tagline, locale)}</p>
                <Link href="/a-propos" className="mt-2 inline-block text-sm underline decoration-accent underline-offset-4">
                  {tr(profile.title, locale)}
                </Link>
              </div>
            </aside>
          </div>

          {toc.length > 2 && (
            <nav aria-label={t("toc")} className="hidden lg:sticky lg:top-24 lg:block lg:self-start" lang={locale}>
              <h2 className="label-mono text-muted-foreground">{t("toc")}</h2>
              <TocList toc={toc} />
            </nav>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="container-site mt-24" aria-labelledby="related">
          <h2 id="related" className="text-(length:--text-h3) font-medium">
            {t("related")}
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <li key={item.id}>
                <PostCard post={item} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="h-24" />
    </>
  );
}

function TocList({ toc }: { toc: { id: string; text: string; level: number }[] }) {
  return (
    <ol className="mt-4 space-y-2 border-l text-sm">
      {toc.map((entry) => (
        <li key={entry.id} className={entry.level === 3 ? "pl-7" : "pl-4"}>
          <a href={`#${entry.id}`} className="-ml-px block border-l border-transparent pl-0 text-muted-foreground hover:text-foreground">
            {entry.text}
          </a>
        </li>
      ))}
    </ol>
  );
}
