import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IssuerSettingsForm, TemplatesSettingsForm } from "@/components/admin/forms/business-settings-forms";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";
import { saveSettingsAction } from "@/server/actions/content";
import { requireAdmin } from "@/server/auth/guards";
import { listLibrary } from "@/server/content/admin-queries";
import { readSettingUncached } from "@/server/content/queries";

export const metadata: Metadata = { title: "Paramètres" };

const TABS = [
  { key: "emetteur", label: "Émetteur des documents" },
  { key: "modeles", label: "Modèles de messages" },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await requireAdmin({ roles: ["super_admin"] });
  const { onglet = "emetteur" } = await searchParams;
  if (!TABS.some((tab) => tab.key === onglet)) notFound();

  const form =
    onglet === "emetteur" ? (
      <IssuerSettingsForm action={saveSettingsAction.bind(null, "issuer")} value={await readSettingUncached("issuer")} library={await listLibrary()} />
    ) : (
      <TemplatesSettingsForm action={saveSettingsAction.bind(null, "templates")} value={await readSettingUncached("templates")} />
    );

  return (
    <>
      <PageHeader title="Paramètres" description="Les profils, textes et CV se règlent dans Contenu, Pages et textes." />
      <nav aria-label="Sections" className="mb-8 flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/parametres?onglet=${tab.key}`}
            aria-current={onglet === tab.key ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm",
              onglet === tab.key ? "border-accent font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {form}
    </>
  );
}
