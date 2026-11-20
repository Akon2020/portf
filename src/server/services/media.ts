import type Sharp from "sharp";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { media, type LocalizedText, type Media, type MediaVariant } from "../db/schema";
import { getStorage } from "../storage/driver";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const VARIANT_WIDTHS = [480, 960, 1600];

type Kind = { mime: string; ext: string; image: boolean };

/** Detects the real file type from its first bytes, never from the name or the browser. */
export function detectFileType(buffer: Buffer): Kind | null {
  const hex = buffer.subarray(0, 12).toString("hex");
  if (hex.startsWith("ffd8ff")) return { mime: "image/jpeg", ext: "jpg", image: true };
  if (hex.startsWith("89504e470d0a1a0a")) return { mime: "image/png", ext: "png", image: true };
  if (hex.startsWith("47494638")) return { mime: "image/gif", ext: "gif", image: true };
  if (hex.startsWith("52494646") && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { mime: "image/webp", ext: "webp", image: true };
  }
  if (buffer.subarray(4, 12).toString("ascii").match(/^ftyp(avif|avis)/)) {
    return { mime: "image/avif", ext: "avif", image: true };
  }
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", ext: "pdf", image: false };
  return null;
}

async function loadSharp() {
  try {
    const moduleName = "sharp";
    return (await import(/* webpackIgnore: true */ moduleName)).default as typeof Sharp;
  } catch {
    // sharp may be unavailable on the host: images are then stored without variants.
    return null;
  }
}

function storageName(): { dir: string; base: string } {
  const now = new Date();
  const dir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return { dir, base: randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x") };
}

export interface SaveMediaInput {
  buffer: Buffer;
  originalName?: string | null;
  alt?: LocalizedText;
  uploadedBy?: string | null;
  sourceUrl?: string | null;
  needsReplacement?: boolean;
}

export class MediaError extends Error {}

/** Validates, stores and indexes an uploaded file. Identical files are deduplicated. */
export async function saveMedia(input: SaveMediaInput): Promise<Media> {
  const { buffer } = input;
  if (buffer.length === 0) throw new MediaError("Fichier vide.");
  if (buffer.length > MAX_UPLOAD_BYTES) throw new MediaError("Fichier trop volumineux (10 Mo maximum).");
  const kind = detectFileType(buffer);
  if (!kind) throw new MediaError("Type de fichier non autorisé (JPEG, PNG, WebP, AVIF, GIF ou PDF).");

  const db = getDb();
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const [existing] = await db
    .select()
    .from(media)
    .where(and(eq(media.checksum, checksum), isNull(media.deletedAt)))
    .limit(1);
  if (existing) return existing;

  const storage = getStorage();
  const { dir, base } = storageName();
  let width: number | null = null;
  let height: number | null = null;
  let blurDataUrl: string | null = null;
  const variants: MediaVariant[] = [];
  let stored = buffer;

  const sharp = kind.image ? await loadSharp() : null;
  if (sharp) {
    // Rotation from EXIF, then every metadata (GPS, camera) is stripped.
    const normalized = sharp(buffer, { animated: kind.mime === "image/gif" }).rotate();
    const meta = await normalized.metadata();
    width = meta.width ?? null;
    height = meta.pageHeight ?? meta.height ?? null;
    stored = kind.mime === "image/gif" ? buffer : await normalized.toBuffer();

    if (kind.mime !== "image/gif" && width) {
      for (const target of VARIANT_WIDTHS.filter((value) => value < width! * 1.1)) {
        const resized = await sharp(stored)
          .resize({ width: Math.min(target, width), withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer({ resolveWithObject: true });
        const path = `${dir}/${base}-${resized.info.width}.webp`;
        await storage.put(path, resized.data);
        variants.push({
          width: resized.info.width,
          height: resized.info.height,
          path,
          size: resized.data.length,
          mime: "image/webp",
        });
      }
      const blur = await sharp(stored).resize(16).webp({ quality: 40 }).toBuffer();
      blurDataUrl = `data:image/webp;base64,${blur.toString("base64")}`;
    }
  }

  const path = `${dir}/${base}.${kind.ext}`;
  await storage.put(path, stored);

  const [row] = await db
    .insert(media)
    .values({
      path,
      originalName: input.originalName?.slice(0, 200) ?? null,
      mime: kind.mime,
      size: stored.length,
      width,
      height,
      checksum,
      alt: input.alt ?? { fr: "" },
      variants,
      blurDataUrl,
      sourceUrl: input.sourceUrl ?? null,
      needsReplacement: input.needsReplacement ?? false,
      uploadedBy: input.uploadedBy ?? null,
    })
    .returning();
  return row;
}

/** Downloads a remote file (used by the content import) and stores it. */
export async function importRemoteMedia(url: string, input: Omit<SaveMediaInput, "buffer" | "sourceUrl">) {
  const response = await fetch(url, { headers: { "user-agent": "portfolio-content-import" } });
  if (!response.ok) throw new MediaError(`Téléchargement impossible (${response.status}) : ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return saveMedia({ ...input, buffer, sourceUrl: url, originalName: input.originalName ?? url.split("/").pop() });
}
