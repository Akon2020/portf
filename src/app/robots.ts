import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/auth", "/espace-client", "/f/", "/api/", "/acces-interne-sauvegarde"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
