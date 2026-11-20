import { tr } from "@/lib/localized";
import { absoluteUrl } from "@/lib/seo";
import { getMediaById, getSetting, getSocialLinks } from "./queries";

/** schema.org Person used on the home and about pages. */
export async function personJsonLd(locale: string) {
  const [profile, contact, socials] = await Promise.all([getSetting("profile"), getSetting("contact"), getSocialLinks()]);
  const portrait = await getMediaById(profile.portraitMediaId);
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    jobTitle: tr(profile.title, locale),
    description: tr(profile.tagline, locale),
    url: absoluteUrl(locale === "fr" ? "/" : "/en"),
    email: `mailto:${contact.email}`,
    image: portrait ? absoluteUrl(portrait.srcSet.at(-1)?.url ?? portrait.url) : undefined,
    address: { "@type": "PostalAddress", addressLocality: "Bukavu", addressCountry: "CD" },
    worksFor: { "@type": "Organization", name: "Akon Tech" },
    alumniOf: { "@type": "CollegeOrUniversity", name: "Université Catholique de Bukavu" },
    sameAs: socials.filter((link) => link.url.startsWith("http")).map((link) => link.url),
  };
}
