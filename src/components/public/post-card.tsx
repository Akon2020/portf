import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { pickLocalized } from "@/lib/localized";
import type { PostSummary } from "@/server/content/blog";
import { MediaImage } from "./media-image";

export function formatPostDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "long", timeZone: "Africa/Lubumbashi" }).format(new Date(value));
}

export async function PostCard({ post, locale, headingLevel = 3 }: { post: PostSummary; locale: string; headingLevel?: 2 | 3 }) {
  const t = await getTranslations("blog");
  const title = pickLocalized(post.title, locale);
  const excerpt = pickLocalized(post.excerpt, locale);
  const minutes = post.readingMinutes[title.lang] ?? post.readingMinutes.fr ?? post.readingMinutes.en;
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-lg">
      {post.cover ? (
        <MediaImage
          media={post.cover}
          locale={locale}
          alt=""
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
          className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-surface">
          <span className="font-heading text-5xl italic text-accent/70">{title.text.slice(0, 1)}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <p className="label-mono flex flex-wrap items-center gap-x-2 text-muted-foreground">
          {post.category && <span className="text-accent">{post.category}</span>}
          {post.category && <span aria-hidden="true">·</span>}
          <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt, locale)}</time>
        </p>
        <Heading lang={title.lang !== locale ? title.lang : undefined} className="mt-3 font-heading text-xl font-medium leading-snug">
          <Link href={{ pathname: "/blog/[slug]", params: { slug: post.slug } }} className="after:absolute after:inset-0 focus-visible:outline-none">
            {title.text}
          </Link>
        </Heading>
        {excerpt.text && (
          <p lang={excerpt.lang !== locale ? excerpt.lang : undefined} className="mt-3 line-clamp-3 text-sm text-muted-foreground">
            {excerpt.text}
          </p>
        )}
        <p className="mt-auto flex items-center justify-between pt-6 text-sm">
          <span className="text-muted-foreground">{minutes ? t("readingTime", { minutes }) : ""}</span>
          <ArrowUpRight className="size-4 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </p>
      </div>
    </article>
  );
}
