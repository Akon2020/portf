import { buildFeed } from "@/server/content/feed";

export const dynamic = "force-dynamic";

export function GET() {
  return buildFeed("fr");
}
