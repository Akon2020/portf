import { and, eq, isNull } from "drizzle-orm";
import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/forms/post-form";
import { PageHeader } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { deletePostAction, savePostAction } from "@/server/actions/blog";
import { requireAdmin } from "@/server/auth/guards";
import { listLibrary } from "@/server/content/admin-queries";
import { getDb } from "@/server/db";
import { posts } from "@/server/db/schema";

export const metadata: Metadata = { title: "Article" };

export default async function AdminPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enregistre?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { enregistre } = await searchParams;
  const isNew = id === "nouveau";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [post] = isNew ? [null] : await getDb().select().from(posts).where(and(eq(posts.id, id), isNull(posts.deletedAt))).limit(1);
  if (!isNew && !post) notFound();
  const library = await listLibrary();

  return (
    <>
      <PageHeader
        title={post ? tr(post.title, "fr") : "Nouvel article"}
        back={{ href: "/admin/blog", label: "Blog" }}
        description={enregistre ? "Article créé." : post?.reviewNote ? <span className="text-warning">À valider : {post.reviewNote}</span> : undefined}
        actions={
          post && (
            <>
              <Link href={`/admin/blog/${post.id}/apercu`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-surface">
                <Eye className="size-4" aria-hidden="true" />
                Aperçu
              </Link>
              <ConfirmButton action={deletePostAction.bind(null, post.id)} confirmText="Supprimer cet article ?" label="Supprimer" />
            </>
          )
        }
      />
      <PostForm action={savePostAction.bind(null, isNew ? null : id)} post={post} library={library} />
    </>
  );
}
