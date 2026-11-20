export const siteConfig = {
  name: "Isaac Akonkwa",
  title: { fr: "Ingénieur logiciel", en: "Software Engineer" },
  description: {
    fr: "Portfolio d’Isaac Akonkwa, ingénieur logiciel full-stack, builder et mentor basé à Bukavu, RDC.",
    en: "Portfolio of Isaac Akonkwa, full-stack software engineer, builder and mentor based in Bukavu, DRC.",
  },
  colors: {
    cream: "#F4F0E8",
    ink: "#132238",
    navy: "#0B1F3A",
    orange: "#D97706",
    green: "#16A34A",
  },
} as const;

export function getSiteUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || "https://isaacakon.vercel.app";
  return new URL(raw);
}
