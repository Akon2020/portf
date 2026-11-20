/* eslint-disable @next/next/no-img-element */
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaEditForm } from "@/components/admin/forms/media-form";
import { PageHeader } from "@/components/admin/page-header";
import { deleteMediaAction, updateMediaAction } from "@/server/actions/content";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { media } from "@/server/db/schema";

export const metadata: Metadata = { title: "Média" };

export default async function MediaEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await getDb().select().from(media).where(eq(media.id, id)).limit(1);
  if (!row || row.deletedAt) notFound();
  const isImage = row.mime.startsWith("image/");
  const preview = row.variants.at(-1)?.path ?? row.path;

  return (
    <>
      <PageHeader title={row.originalName ?? "Média"} back={{ href: "/admin/contenu/medias", label: "Médiathèque" }} />
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          {isImage ? (
            <img src={`/media/${preview}`} alt={row.alt.fr} className="w-full rounded-xl border bg-surface object-contain" />
          ) : (
            <a href={`/media/${row.path}`} target="_blank" rel="noopener" className="block rounded-xl border p-6 text-sm underline">
              Ouvrir le document
            </a>
          )}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{row.mime}</dd>
            <dt className="text-muted-foreground">Taille</dt>
            <dd>{(row.size / 1024).toFixed(0)} Ko</dd>
            {row.width && (
              <>
                <dt className="text-muted-foreground">Dimensions</dt>
                <dd>
                  {row.width} x {row.height} px
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">Variantes</dt>
            <dd>{row.variants.map((variant) => `${variant.width} px`).join(", ") || "Aucune"}</dd>
            <dt className="text-muted-foreground">Adresse</dt>
            <dd className="break-all font-mono text-xs">/media/{row.path}</dd>
            {row.sourceUrl && (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="break-all text-xs">{row.sourceUrl}</dd>
              </>
            )}
          </dl>
        </div>
        <MediaEditForm
          action={updateMediaAction.bind(null, id)}
          deleteAction={deleteMediaAction.bind(null, id)}
          alt={row.alt}
          needsReplacement={row.needsReplacement}
        />
      </div>
    </>
  );
}
