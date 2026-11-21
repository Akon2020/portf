import { and, eq, isNull } from "drizzle-orm";
import { AuthError, requireClient } from "@/server/auth/guards";
import { getDb } from "@/server/db";
import { clientProjects, clients, projectFiles } from "@/server/db/schema";
import { privateFileResponse } from "@/server/storage/download";

/** Project file download for the client: own projects and visible files only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let clientId: string;
  try {
    ({ clientId } = await requireClient({ redirectTo: false }));
  } catch (error) {
    if (error instanceof AuthError) return new Response("Unauthorized", { status: 401 });
    throw error;
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [row] = await getDb()
    .select({ file: projectFiles.file })
    .from(projectFiles)
    .innerJoin(clientProjects, eq(clientProjects.id, projectFiles.clientProjectId))
    .innerJoin(clients, eq(clients.id, clientProjects.clientId))
    .where(
      and(
        eq(projectFiles.id, id),
        eq(projectFiles.visibleToClient, true),
        eq(clientProjects.clientId, clientId),
        eq(clientProjects.visibleToClient, true),
        isNull(clientProjects.deletedAt),
        eq(clients.portalEnabled, true),
      ),
    )
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });
  return privateFileResponse(row.file);
}
