/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { STATUS_LABELS, TESTIMONIAL_STATUS_LABELS } from "@/components/admin/labels";
import { EmptyState, PageHeader } from "@/components/admin/page-header";
import { ActionButton, Badge } from "@/components/admin/ui";
import { tr } from "@/lib/localized";
import { markReviewedAction } from "@/server/actions/content";
import { requireAdmin } from "@/server/auth/guards";
import { reviewQueue } from "@/server/content/admin-queries";

export const metadata: Metadata = { title: "À valider" };

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-sans text-lg font-semibold tracking-normal">
        {title} <span className="font-mono text-sm text-muted-foreground">{count}</span>
      </h2>
      <ul className="divide-y overflow-hidden rounded-xl border">{children}</ul>
    </section>
  );
}

function Item({ href, title, status, note, action }: { href: string; title: string; status: string; note?: string | null; action?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <Link href={href} className="font-medium hover:text-accent">
          {title}
        </Link>{" "}
        <Badge>{status}</Badge>
        {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      </div>
      {action}
    </li>
  );
}

export default async function ReviewPage() {
  await requireAdmin();
  const queue = await reviewQueue();
  const total = queue.projects.length + queue.journey.length + queue.testimonials.length + queue.media.length;

  return (
    <>
      <PageHeader
        title="À valider"
        description="Contenus importés ou incohérents à confirmer avant publication. Rien n'est inventé : complétez, corrigez ou supprimez."
      />
      {total === 0 ? (
        <EmptyState>Tout est validé.</EmptyState>
      ) : (
        <div className="space-y-10">
          <Group title="Projets" count={queue.projects.length}>
            {queue.projects.map((item) => (
              <Item
                key={item.id}
                href={`/admin/contenu/projets/${item.id}`}
                title={tr(item.title, "fr")}
                status={STATUS_LABELS[item.status]}
                note={item.note}
                action={<ActionButton action={markReviewedAction.bind(null, "project", item.id)} label="Marquer comme validé" />}
              />
            ))}
          </Group>
          <Group title="Parcours" count={queue.journey.length}>
            {queue.journey.map((item) => (
              <Item
                key={item.id}
                href={`/admin/contenu/parcours/${item.id}`}
                title={`${tr(item.title, "fr")} · ${item.organization}`}
                status={STATUS_LABELS[item.status]}
                note={item.note}
                action={<ActionButton action={markReviewedAction.bind(null, "journey", item.id)} label="Marquer comme validé" />}
              />
            ))}
          </Group>
          <Group title="Témoignages" count={queue.testimonials.length}>
            {queue.testimonials.map((item) => (
              <Item
                key={item.id}
                href={`/admin/contenu/temoignages/${item.id}`}
                title={`« ${tr(item.quote, "fr").slice(0, 80)} »`}
                status={TESTIMONIAL_STATUS_LABELS[item.status]}
                note={item.note}
                action={<ActionButton action={markReviewedAction.bind(null, "testimonial", item.id)} label="Marquer comme validé" />}
              />
            ))}
          </Group>
          <Group title="Visuels à remplacer" count={queue.media.length}>
            {queue.media.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-4 py-3">
                <img src={`/media/${item.variants[0]?.path ?? item.path}`} alt="" className="h-12 w-16 rounded object-cover" />
                <Link href={`/admin/contenu/medias/${item.id}`} className="font-medium hover:text-accent">
                  {item.alt.fr || "Sans texte alternatif"}
                </Link>
              </li>
            ))}
          </Group>
        </div>
      )}
    </>
  );
}
