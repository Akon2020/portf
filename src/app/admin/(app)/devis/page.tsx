import { Paperclip } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { contacts, quoteRequests } from "@/server/db/schema";
import { REQUEST_LABELS } from "@/server/services/quote-requests";

export const metadata: Metadata = { title: "Demandes de devis" };

const COLUMNS = ["new", "reviewing", "quoted", "won", "lost"] as const;
const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeZone: "Africa/Lubumbashi" });

export default async function QuoteRequestsPage() {
  await requireAdmin();
  const rows = await getDb()
    .select({ request: quoteRequests, contactName: contacts.name, company: contacts.company })
    .from(quoteRequests)
    .innerJoin(contacts, eq(contacts.id, quoteRequests.contactId))
    .orderBy(desc(quoteRequests.createdAt))
    .limit(300);

  return (
    <>
      <PageHeader title="Demandes de devis" description="Pipeline des demandes reçues depuis le formulaire public." />
      <div className="grid gap-4 overflow-x-auto pb-2 lg:grid-cols-5">
        {COLUMNS.map((status) => {
          const items = rows.filter((row) => row.request.status === status);
          return (
            <section key={status} aria-labelledby={`col-${status}`} className="min-w-60 rounded-xl border bg-surface/40 p-3">
              <h2 id={`col-${status}`} className="mb-3 flex items-center justify-between font-sans text-sm font-semibold tracking-normal">
                {REQUEST_LABELS.status[status]}
                <span className="font-mono text-xs text-muted-foreground">{items.length}</span>
              </h2>
              <ul className="space-y-2">
                {items.length === 0 && <li className="text-xs text-muted-foreground">Aucune demande.</li>}
                {items.map(({ request, contactName, company }) => (
                  <li key={request.id}>
                    <Link href={`/admin/devis/${request.id}`} className="block rounded-lg border bg-card p-3 text-sm hover:border-accent">
                      <span className="block font-medium">{company ?? contactName}</span>
                      <span className="block text-muted-foreground">
                        {REQUEST_LABELS.projectType[request.projectType as keyof typeof REQUEST_LABELS.projectType] ?? request.projectType}
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{REQUEST_LABELS.budget[request.budgetRange as keyof typeof REQUEST_LABELS.budget] ?? ""}</span>
                        <span className="flex items-center gap-1.5">
                          {request.attachments.length > 0 && <Paperclip className="size-3" aria-label="Pièces jointes" />}
                          {dateFormat.format(request.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
