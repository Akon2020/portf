import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tr } from "@/lib/localized";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { posts } from "@/server/db/schema";

export const metadata: Metadata = { title: "Aperçu de l'article" };

/** Draft preview with the public article styles, both languages. */
export default async function PostPreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ langue?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { langue } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [post] = await getDb().select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!post) notFound();
  const locale = langue === "en" ? "en" : "fr";
  const html = locale === "en" && post.contentHtml.en ? post.contentHtml.en : post.contentHtml.fr;

  return (
    <article className="mx-auto max-w-3xl">
      <p className="mb-6 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Aperçu ({locale.toUpperCase()}) de la dernière version enregistrée.{" "}
        <a href={`?langue=${locale === "fr" ? "en" : "fr"}`} className="underline underline-offset-4">
          Voir en {locale === "fr" ? "anglais" : "français"}
        </a>
      </p>
      <h1 className="font-heading text-4xl font-medium leading-tight">{tr(post.title, locale)}</h1>
      <p className="mt-4 text-lg text-muted-foreground">{tr(post.excerpt, locale)}</p>
      <div className="rich-content mt-10" dangerouslySetInnerHTML={{ __html: html || "<p>Contenu vide.</p>" }} />
    </article>
  );
}
