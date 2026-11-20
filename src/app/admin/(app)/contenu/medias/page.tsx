/* eslint-disable @next/next/no-img-element */
import { AlertTriangle, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MediaUploader } from "@/components/admin/media-uploader";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/auth/guards";
import { listLibrary } from "@/server/content/admin-queries";

export const metadata: Metadata = { title: "Médiathèque" };

export default async function MediaLibraryPage() {
  await requireAdmin();
  const items = await listLibrary();
  const missingAlt = items.filter((item) => item.mime.startsWith("image/") && !item.alt.fr).length;
  return (
    <>
      <PageHeader
        title="Médiathèque"
        description={`${items.length} fichiers${missingAlt ? `, ${missingAlt} sans texte alternatif` : ""}`}
        back={{ href: "/admin/contenu", label: "Contenu" }}
      />
      <MediaUploader />
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/admin/contenu/medias/${item.id}`} className="group block overflow-hidden rounded-xl border bg-card hover:border-accent">
              <div className="relative aspect-[4/3] bg-surface">
                {item.mime.startsWith("image/") ? (
                  <img src={item.thumb} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="grid size-full place-items-center text-muted-foreground">
                    <FileText className="size-8" aria-hidden="true" />
                  </span>
                )}
                {item.needsReplacement && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-warning px-1.5 py-0.5 text-[10px] font-medium text-white">
                    <AlertTriangle className="size-3" aria-hidden="true" />À remplacer
                  </span>
                )}
              </div>
              <p className={item.alt.fr ? "truncate p-2 text-xs" : "truncate p-2 text-xs text-destructive"}>
                {item.alt.fr || "Texte alternatif manquant"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
