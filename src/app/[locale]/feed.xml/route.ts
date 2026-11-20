import { notFound } from "next/navigation";
import { buildFeed } from "@/server/content/feed";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "fr" && locale !== "en") notFound();
  return buildFeed(locale);
}
