import { Readable } from "node:stream";
import { getStorage } from "@/server/storage/driver";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};

/** Serves stored files. Names are random and never reused, so they are cached forever. */
export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const path = segments.join("/");
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[ext];
  if (!type) return new Response("Not found", { status: 404 });

  const storage = getStorage();
  const info = await storage.stat(path);
  if (!info) return new Response("Not found", { status: 404 });

  const etag = `"${info.size.toString(16)}-${info.modifiedAt.getTime().toString(16)}"`;
  const headers = new Headers({
    "Content-Type": type,
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  headers.set("Content-Length", String(info.size));
  const stream = Readable.toWeb(storage.read(path)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
}
