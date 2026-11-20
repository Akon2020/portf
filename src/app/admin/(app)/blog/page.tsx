import { and, desc, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NewButton, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { posts } from "@/server/db/schema";

export const metadata: Metadata = { title: "Blog" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lubumbashi" });

export default async function AdminBlogPage() {
  await requireAdmin();
  const rows = await getDb()
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      status: posts.status,
      publishedAt: posts.publishedAt,
      category: posts.category,
      needsReview: posts.needsReview,
      contentHtml: posts.contentHtml,
      readingMinutes: posts.readingMinutes,
      live: sql<boolean>`(${posts.status} = 'published' or (${posts.status} = 'scheduled' and ${posts.publishedAt} <= now()))`,
    })
    .from(posts)
    .where(and(isNull(posts.deletedAt)))
    .orderBy(desc(posts.updatedAt));

  return (
    <>
      <PageHeader title="Blog" description={`${rows.length} articles`} actions={<NewButton href="/admin/blog/nouveau" label="Nouvel article" />} />
      {rows.length === 0 ? (
        <EmptyState>Aucun article pour le moment.</EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border">
          {rows.map((post) => {
            const live = post.live;
            return (
              <li key={post.id}>
                <Link href={`/admin/blog/${post.id}`} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-surface/40 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{tr(post.title, "fr")}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[post.category, post.readingMinutes.fr ? `${post.readingMinutes.fr} min` : "contenu vide", post.contentHtml.en ? "FR et EN" : "FR"]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {post.needsReview && <Badge tone="warning">À valider</Badge>}
                    {live ? (
                      <Badge tone="success">Publié {post.publishedAt ? `le ${dateTime.format(post.publishedAt)}` : ""}</Badge>
                    ) : post.status === "scheduled" ? (
                      <Badge tone="info">Programmé {post.publishedAt ? `pour le ${dateTime.format(post.publishedAt)}` : ""}</Badge>
                    ) : (
                      <Badge>Brouillon</Badge>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
