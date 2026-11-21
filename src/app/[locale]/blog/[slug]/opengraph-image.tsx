import { OG_SIZE, ogCard } from "@/lib/og";
import { pickLocalized } from "@/lib/localized";
import { getPostBySlug } from "@/server/content/blog";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Isaac Akonkwa, blog";

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const post = await getPostBySlug(slug);
  const minutes = post ? post.readingMinutes[pickLocalized(post.contentHtml, locale).lang] : undefined;
  return ogCard({
    eyebrow: post?.category ? `Blog · ${post.category}` : "Blog",
    title: post ? pickLocalized(post.title, locale).text : "Isaac Akonkwa",
    footer: minutes ? (locale === "fr" ? `${minutes} min de lecture` : `${minutes} min read`) : "",
  });
}
