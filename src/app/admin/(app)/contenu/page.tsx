import { BarChart3, BriefcaseBusiness, FileText, FolderKanban, Images, Link2, MessageSquareQuote, Route, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/server/auth/guards";
import { contentCounts } from "@/server/content/admin-queries";

export const metadata: Metadata = { title: "Contenu" };

const SECTIONS = [
  { href: "projets", label: "Projets", icon: FolderKanban, key: "projets", text: "Études de cas, visuels, résultats" },
  { href: "parcours", label: "Parcours", icon: Route, key: "parcours", text: "Expériences, formation, communauté" },
  { href: "competences", label: "Compétences", icon: Wrench, key: "competences", text: "Stack par domaine et niveau" },
  { href: "services", label: "Services", icon: BriefcaseBusiness, key: "services", text: "Offres et livrables" },
  { href: "temoignages", label: "Témoignages", icon: MessageSquareQuote, key: "temoignages", text: "Citations et accords" },
  { href: "chiffres", label: "Chiffres clés", icon: BarChart3, key: "chiffres", text: "Valeurs du hero" },
  { href: "reseaux", label: "Réseaux sociaux", icon: Link2, key: "reseaux", text: "Liens du site" },
  { href: "medias", label: "Médiathèque", icon: Images, key: "medias", text: "Images et documents" },
  { href: "pages", label: "Pages et textes", icon: FileText, key: null, text: "Profil, contact, mentions légales, CV" },
] as const;

export default async function ContentHubPage() {
  await requireAdmin();
  const counts = await contentCounts();
  return (
    <>
      <PageHeader title="Contenu" description="Tout ce qui s'affiche sur le site public." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map(({ href, label, icon: Icon, key, text }) => (
          <li key={href}>
            <Link href={`/admin/contenu/${href}`} className="flex h-full items-start gap-4 admin-card p-5 transition-colors hover:border-accent">
              <Icon className="mt-0.5 size-5 text-accent" aria-hidden="true" />
              <span className="flex-1">
                <span className="flex items-center justify-between gap-2 font-medium">
                  {label}
                  {key && <span className="font-mono text-xs text-muted-foreground">{counts[key]}</span>}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
