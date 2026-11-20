import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContactSettingsForm, CvSettingsForm, LegalSettingsForm, ProfileSettingsForm } from "@/components/admin/forms/settings-forms";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";
import { saveSettingsAction } from "@/server/actions/content";
import { requireAdmin } from "@/server/auth/guards";
import { listLibrary } from "@/server/content/admin-queries";
import { getSetting } from "@/server/content/queries";

export const metadata: Metadata = { title: "Pages et textes" };

const TABS = [
  { key: "profil", label: "Profil et accueil" },
  { key: "contact", label: "Contact" },
  { key: "legal", label: "Mentions légales" },
  { key: "cv", label: "CV" },
] as const;

export default async function PagesSettingsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  await requireAdmin();
  const { onglet = "profil" } = await searchParams;
  if (!TABS.some((tab) => tab.key === onglet)) notFound();

  let form: React.ReactNode;
  if (onglet === "profil") {
    const [value, library] = await Promise.all([getSetting("profile"), listLibrary()]);
    form = <ProfileSettingsForm action={saveSettingsAction.bind(null, "profile")} value={value} library={library} />;
  } else if (onglet === "contact") {
    form = <ContactSettingsForm action={saveSettingsAction.bind(null, "contact")} value={await getSetting("contact")} />;
  } else if (onglet === "legal") {
    form = <LegalSettingsForm action={saveSettingsAction.bind(null, "legal")} value={await getSetting("legal")} />;
  } else {
    const [value, library] = await Promise.all([getSetting("cv"), listLibrary()]);
    form = <CvSettingsForm action={saveSettingsAction.bind(null, "cv")} value={value} library={library} />;
  }

  return (
    <>
      <PageHeader title="Pages et textes" back={{ href: "/admin/contenu", label: "Contenu" }} />
      <nav aria-label="Sections" className="mb-8 flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/admin/contenu/pages?onglet=${tab.key}`}
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
