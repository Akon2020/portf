import { desc, eq, isNull, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, NewButton, PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { galleryAlbums, media } from "@/server/db/schema";

export const metadata: Metadata = { title: "Galerie" };

const STATUS = { draft: ["Brouillon", "neutral"], published: ["Publié", "success"], archived: ["Archivé", "warning"] } as const;

export default async function AdminGalleryPage() {
  await requireAdmin();
  const rows = await getDb()
    .select({
      album: galleryAlbums,
      count: sql<number>`(select count(*)::int from gallery_items gi where gi.album_id = ${galleryAlbums.id})`,
      cover: media.path,
      firstImage: sql<string | null>`(select m.path from gallery_items gi join media m on m.id = gi.media_id where gi.album_id = ${galleryAlbums.id} order by gi.sort_order limit 1)`,
    })
    .from(galleryAlbums)
    .leftJoin(media, eq(media.id, galleryAlbums.coverImageId))
    .where(isNull(galleryAlbums.deletedAt))
    .orderBy(galleryAlbums.sortOrder, desc(galleryAlbums.eventDate));

  return (
    <>
      <PageHeader title="Galerie" description={`${rows.length} albums`} actions={<NewButton href="/admin/galerie/nouveau" label="Nouvel album" />} />
      {rows.length === 0 ? (
        <EmptyState>Aucun album. Créez-en un pour les ateliers, conférences et événements.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ album, count, cover, firstImage }) => {
            const image = cover ?? firstImage;
            const [label, tone] = STATUS[album.status];
            return (
              <li key={album.id}>
                <Link href={`/admin/galerie/${album.id}`} className="admin-card group block overflow-hidden hover:shadow-md">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- files served by the media route
                    <img src={`/media/${image}`} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="aspect-[16/9] w-full bg-surface" />
                  )}
                  <div className="flex items-start justify-between gap-3 p-4">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{tr(album.title, "fr")}</span>
                      <span className="block text-sm text-muted-foreground">{[`${count} photos`, album.location, album.eventDate].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
