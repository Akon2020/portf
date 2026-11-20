import { OG_SIZE, ogCard } from "@/lib/og";
import { tr } from "@/lib/localized";
import { getSetting } from "@/server/content/queries";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Isaac Akonkwa";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const profile = await getSetting("profile");
  return ogCard({
    eyebrow: `${tr(profile.title, locale)} · ${tr(profile.location, locale)}`,
    title: tr(profile.heroHeading, locale),
    footer: locale === "fr" ? "Web · Mobile · IA · Sécurité" : "Web · Mobile · AI · Security",
  });
}
