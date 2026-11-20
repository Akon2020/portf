import { pickLocalized } from "@/lib/localized";
import { absoluteUrl, localizedPath } from "@/lib/seo";
import { getPublishedPosts } from "./blog";
import { getSetting } from "./queries";

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char]!);
}

/** RSS 2.0 feed of the published articles, in the requested language with fallback. */
export async function buildFeed(locale: "fr" | "en"): Promise<Response> {
  const [posts, profile] = await Promise.all([getPublishedPosts(), getSetting("profile")]);
  const blogUrl = absoluteUrl(localizedPath("/blog", locale));
  const selfUrl = absoluteUrl(locale === "fr" ? "/feed.xml" : "/en/feed.xml");
  const items = posts.slice(0, 50).map((post) => {
    const url = absoluteUrl(localizedPath({ pathname: "/blog/[slug]", params: { slug: post.slug } }, locale));
    const categories = [post.category, ...post.tags].filter(Boolean).map((value) => `      <category>${escapeXml(value!)}</category>`);
    return [
      "    <item>",
      `      <title>${escapeXml(pickLocalized(post.title, locale).text)}</title>`,
      `      <link>${escapeXml(url)}</link>`,
      `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
      `      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(pickLocalized(post.excerpt, locale).text)}</description>`,
      ...categories,
      "    </item>",
    ].join("\n");
  });
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(`Blog | ${profile.name}`)}</title>`,
    `    <link>${escapeXml(blogUrl)}</link>`,
    `    <description>${escapeXml(pickLocalized(profile.tagline, locale).text)}</description>`,
    `    <language>${locale === "fr" ? "fr-FR" : "en-US"}</language>`,
    `    <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml" />`,
    posts[0] ? `    <lastBuildDate>${new Date(posts[0].publishedAt).toUTCString()}</lastBuildDate>` : "",
    ...items,
    "  </channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900, s-maxage=900" },
  });
}
