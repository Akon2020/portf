import { eq } from "drizzle-orm";
import { AuthError, requireAdmin } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { projectFiles } from "@/server/db/schema";
import { privateFileResponse } from "@/server/storage/download";

/** Downloads a client project file. Admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin({ redirectTo: false });
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await getDb().select().from(projectFiles).where(eq(projectFiles.id, id)).limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  return privateFileResponse(row.file);
}
