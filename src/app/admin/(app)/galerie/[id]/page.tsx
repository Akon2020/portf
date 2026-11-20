import { and, asc, eq, isNull } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlbumForm } from "@/components/admin/forms/album-form";
import { PageHeader } from "@/components/admin/page-header";
import { ConfirmButton } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { deleteAlbumAction, saveAlbumAction } from "@/server/actions/blog";
import { requireAdmin } from "@/server/auth/guards";
import { listLibrary } from "@/server/content/admin-queries";
import { getDb } from "@/server/db";
import { galleryAlbums, galleryItems } from "@/server/db/schema";

export const metadata: Metadata = { title: "Album" };

export default async function AdminAlbumPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enregistre?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { enregistre } = await searchParams;
  const isNew = id === "nouveau";
  if (!isNew && !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getDb();
  const [album] = isNew ? [null] : await db.select().from(galleryAlbums).where(and(eq(galleryAlbums.id, id), isNull(galleryAlbums.deletedAt))).limit(1);
  if (!isNew && !album) notFound();
  const [items, library] = await Promise.all([
    album ? db.select().from(galleryItems).where(eq(galleryItems.albumId, album.id)).orderBy(asc(galleryItems.sortOrder)) : Promise.resolve([]),
    listLibrary(),
  ]);

  return (
    <>
      <PageHeader
        title={album ? tr(album.title, "fr") : "Nouvel album"}
        back={{ href: "/admin/galerie", label: "Galerie" }}
        description={enregistre ? "Album créé." : undefined}
        actions={
          album && (
            <>
              {album.status === "published" && (
                <a href={`/galerie/${album.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-card px-3 text-sm hover:bg-surface">
                  <ExternalLink className="size-4" aria-hidden="true" /> Voir
                </a>
              )}
              <ConfirmButton action={deleteAlbumAction.bind(null, album.id)} confirmText="Supprimer cet album ? Les photos restent dans la médiathèque." label="Supprimer" />
            </>
          )
        }
      />
      <AlbumForm
        action={saveAlbumAction.bind(null, isNew ? null : id)}
        album={album}
        items={items.map((item) => ({ mediaId: item.mediaId, caption: { fr: item.caption.fr, en: item.caption.en ?? "" } }))}
        library={library}
      />
    </>
  );
}
