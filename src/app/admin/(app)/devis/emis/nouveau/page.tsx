import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { createQuoteDraftAction } from "@/server/actions/quotes";
import { requireAdmin } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Nouveau devis" };

/** Confirmation step: creating a draft is a POST, never a side effect of opening a link. */
export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ conversation?: string; demande?: string }> }) {
  await requireAdmin();
  const { conversation, demande } = await searchParams;
  return (
    <>
      <PageHeader title="Nouveau devis" back={{ href: "/admin/devis/emis", label: "Devis émis" }} />
      <form action={createQuoteDraftAction} className="max-w-lg space-y-4 rounded-xl border bg-card p-6">
        {conversation && <input type="hidden" name="conversationId" value={conversation} />}
        {demande && <input type="hidden" name="requestId" value={demande} />}
        <p className="text-sm text-muted-foreground">
          {conversation || demande
            ? "Le brouillon sera pré-rempli avec les coordonnées du contact et la demande associée."
            : "Un brouillon vide sera créé."}
        </p>
        <Button type="submit">Créer le brouillon</Button>
      </form>
    </>
  );
}
