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

/**
 * Public URL of the site, read at runtime. NEXT_PUBLIC_ variables are frozen
 * at build time by Next, so the server uses SITE_URL, set on the host.
 */
export function getSiteUrl(): URL {
  const env = process.env as Record<string, string | undefined>;
  const raw = env["SITE_URL"] || env["NEXT_PUBLIC_" + "SITE_URL"] || "http://localhost:3000";
  return new URL(raw);
}
