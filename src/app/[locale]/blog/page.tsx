import { ChevronLeft, ChevronRight, Rss, Search, X } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ContactCta } from "@/components/public/contact-cta";
import { PostCard } from "@/components/public/post-card";
import { SectionLabel } from "@/components/public/section-heading";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { tr } from "@/lib/localized";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { getPublishedPosts } from "@/server/content/blog";

const PAGE_SIZE = 9;

type SearchParams = Promise<{ q?: string; categorie?: string; tag?: string; page?: string }>;

export async function generateMetadata({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: SearchParams }): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: "blog" });
  const filtered = Boolean(query.q || query.categorie || query.tag || (query.page && query.page !== "1"));
  const metadata = pageMetadata({ locale, href: "/blog", title: t("title"), description: t("intro"), noIndex: filtered });
  return {
    ...metadata,
    alternates: { ...metadata.alternates, types: { "application/rss+xml": locale === "fr" ? "/feed.xml" : "/en/feed.xml" } },
  };
}

function normalize(text: string) {
  return text.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default async function BlogPage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: SearchParams }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const [t, all] = await Promise.all([getTranslations("blog"), getPublishedPosts()]);

  const q = (query.q ?? "").trim().slice(0, 80);
  const category = query.categorie?.slice(0, 60);
  const tag = query.tag?.slice(0, 60);
  const categories = [...new Set(all.map((post) => post.category).filter((value): value is string => Boolean(value)))].sort();
  const tags = [...new Set(all.flatMap((post) => post.tags))].sort();

  const needle = normalize(q);
  const filtered = all.filter(
    (post) =>
      (!category || post.category === category) &&
      (!tag || post.tags.includes(tag)) &&
      (!needle ||
        normalize([tr(post.title, locale), post.title.en ?? "", tr(post.excerpt, locale), post.excerpt.en ?? "", ...post.tags, post.category ?? ""].join(" ")).includes(needle)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const baseQuery = { ...(q ? { q } : {}), ...(category ? { categorie: category } : {}), ...(tag ? { tag } : {}) };
  const hasFilters = Boolean(q || category || tag);

  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
      active ? "border-foreground bg-foreground text-background" : "hover:bg-surface",
    );

  return (
    <>
      <section className="container-site pt-16 md:pt-24">
        <SectionLabel label={t("title")} />
        <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-3xl text-(length:--text-hero) font-medium leading-[0.98]">{t("title")}</h1>
            <p className="mt-6 max-w-2xl text-(length:--text-body) text-muted-foreground">{t("intro")}</p>
          </div>
          <a href={locale === "fr" ? "/feed.xml" : "/en/feed.xml"} className="inline-flex items-center gap-2 self-start text-sm text-muted-foreground hover:text-accent lg:self-auto">
            <Rss className="size-4" aria-hidden="true" /> {t("rss")}
          </a>
        </div>

        {all.length > 0 && (
          <div className="mt-12 space-y-5">
            <form role="search" action="" method="get" className="flex max-w-xl gap-2">
              {category && <input type="hidden" name="categorie" value={category} />}
              {tag && <input type="hidden" name="tag" value={tag} />}
              <label htmlFor="blog-search" className="sr-only">
                {t("search")}
              </label>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <input
                  id="blog-search"
                  type="search"
                  name="q"
                  defaultValue={q}
                  maxLength={80}
                  placeholder={t("search")}
                  className="h-11 w-full rounded-full border bg-card pl-11 pr-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              </div>
              <button type="submit" className="h-11 shrink-0 rounded-full bg-foreground px-5 text-sm font-medium text-background">
                {t("searchButton")}
              </button>
            </form>

            {categories.length > 0 && (
              <nav aria-label={t("categories")}>
                <ul className="flex flex-wrap gap-2">
                  <li>
                    <Link href={{ pathname: "/blog", query: { ...(q ? { q } : {}), ...(tag ? { tag } : {}) } }} className={chip(!category)} aria-current={!category ? "page" : undefined}>
                      {t("all")}
                    </Link>
                  </li>
                  {categories.map((item) => (
                    <li key={item}>
                      <Link
                        href={{ pathname: "/blog", query: { ...(q ? { q } : {}), ...(tag ? { tag } : {}), categorie: item } }}
                        className={chip(category === item)}
                        aria-current={category === item ? "page" : undefined}
                      >
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {tags.length > 0 && (
              <nav aria-label={t("tags")}>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                  {tags.map((item) => (
                    <li key={item}>
                      <Link
                        href={{ pathname: "/blog", query: { ...(q ? { q } : {}), ...(category ? { categorie: category } : {}), ...(tag === item ? {} : { tag: item }) } }}
                        className={cn("hover:text-accent", tag === item ? "text-accent underline underline-offset-4" : "text-muted-foreground")}
                        aria-current={tag === item ? "page" : undefined}
                      >
                        #{item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {hasFilters && (
              <p className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground" role="status">
                {q ? t("resultsFor", { query: q }) : t("filteredBy", { filter: [category, tag && `#${tag}`].filter(Boolean).join(", ") })}
                <span aria-hidden="true">·</span>
                <span>{filtered.length}</span>
                <Link href="/blog" className="inline-flex items-center gap-1 text-foreground underline underline-offset-4">
                  <X className="size-3.5" aria-hidden="true" /> {t("clear")}
                </Link>
              </p>
            )}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="mt-14 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{all.length === 0 ? t("emptyAll") : t("empty")}</p>
        ) : (
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <li key={post.id}>
                <PostCard post={post} locale={locale} headingLevel={2} />
              </li>
            ))}
          </ul>
        )}

        {pages > 1 && (
          <nav aria-label={t("pagination")} className="mt-12 flex items-center justify-between gap-4 border-t pt-6 text-sm">
            {page > 1 ? (
              <Link href={{ pathname: "/blog", query: { ...baseQuery, ...(page > 2 ? { page: String(page - 1) } : {}) } }} className="inline-flex items-center gap-1.5 hover:text-accent" rel="prev">
                <ChevronLeft className="size-4" aria-hidden="true" /> {t("previousPage")}
              </Link>
            ) : (
              <span />
            )}
            <span className="label-mono text-muted-foreground">{t("pageOf", { current: page, total: pages })}</span>
            {page < pages ? (
              <Link href={{ pathname: "/blog", query: { ...baseQuery, page: String(page + 1) } }} className="inline-flex items-center gap-1.5 hover:text-accent" rel="next">
                {t("nextPage")} <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </section>
      <ContactCta locale={locale} />
    </>
  );
}
