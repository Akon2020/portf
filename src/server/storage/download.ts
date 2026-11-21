import { Readable } from "node:stream";
import type { Attachment } from "../db/schema";
import { getPrivateStorage } from "./private";

/** Streams a private file as a download, never rendered inline by the browser. */
export async function privateFileResponse(file: Attachment): Promise<Response> {
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
