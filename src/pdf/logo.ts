import { eq } from "drizzle-orm";
import { getDb } from "@/server/db";
import { media } from "@/server/db/schema";
import { getStorage } from "@/server/storage/driver";

const cache = new Map<string, string>();

async function readAll(path: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of getStorage().read(path)) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/**
 * Logo of the issuer as a PNG data URL: PDF documents cannot embed WebP or
 * AVIF, so the stored image is converted once and kept in memory.
 */
export async function loadLogo(mediaId: string | null): Promise<string | null> {
  if (!mediaId) return null;
  const cached = cache.get(mediaId);
  if (cached) return cached;
  try {
    const [row] = await getDb().select().from(media).where(eq(media.id, mediaId)).limit(1);
    if (!row || row.deletedAt || !row.mime.startsWith("image/")) return null;
    const source = row.variants.at(-1)?.path ?? row.path;
    const { default: sharp } = await import("sharp");
    const png = await sharp(await readAll(source))
      .resize(240, 240, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    cache.set(mediaId, dataUrl);
    return dataUrl;
  } catch (error) {
    // A broken logo never prevents the document from being generated.
    console.error("[pdf] logo unavailable", error instanceof Error ? error.message : error);
    return null;
  }
}
