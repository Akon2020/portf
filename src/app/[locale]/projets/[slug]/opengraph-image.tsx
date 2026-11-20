import { OG_SIZE, ogCard } from "@/lib/og";
import { tr } from "@/lib/localized";
import { getProjectDetail } from "@/server/content/queries";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Isaac Akonkwa, projet";

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const detail = await getProjectDetail(slug);
  const project = detail?.project;
  return ogCard({
    eyebrow: locale === "fr" ? "Étude de cas" : "Case study",
    title: project ? tr(project.title, locale) : "Isaac Akonkwa",
    footer: project ? project.techStack.slice(0, 3).join(" · ") : "",
  });
}
