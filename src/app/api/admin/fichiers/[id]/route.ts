import { sql } from "drizzle-orm";
import { Readable } from "node:stream";
import { AuthError, requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import type { Attachment } from "@/server/db/schema";
import { getPrivateStorage } from "@/server/storage/private";

/** Downloads a private attachment (messages, quote requests). Admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });

  const needle = JSON.stringify([{ id }]);
  const rows = await getDb().execute<{ attachments: Attachment[] }>(sql`
    select attachments from messages where attachments @> ${needle}::jsonb
    union all
    select attachments from quote_requests where attachments @> ${needle}::jsonb
    limit 1
  `);
  const file = rows[0]?.attachments.find((item) => item.id === id);
  if (!file) return new Response("Not found", { status: 404 });

  const storage = getPrivateStorage();
  const info = await storage.stat(file.path);
  if (!info) return new Response("Not found", { status: 404 });

  return new Response(Readable.toWeb(storage.read(file.path)) as ReadableStream, {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(info.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
