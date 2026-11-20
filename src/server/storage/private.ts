import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import type { Attachment } from "../db/schema";
import { detectFileType, MAX_UPLOAD_BYTES } from "../services/media";
import { LocalStorageDriver } from "./driver";

/** Visitor files live outside the public uploads folder and are never served by /media. */
export function privateRoot(): string {
  return resolve(process.env.PRIVATE_DIR ?? `${process.env.DATA_DIR ?? "./portfolio_data"}/private`);
}

let driver: LocalStorageDriver | undefined;
export function getPrivateStorage(): LocalStorageDriver {
  driver ??= new LocalStorageDriver(privateRoot());
  return driver;
}

export const MAX_ATTACHMENTS = 5;

export class AttachmentError extends Error {
  constructor(public readonly code: "fileType" | "fileSize" | "tooManyFiles") {
    super(code);
  }
}

/** Checks real file types (PDF or image), sizes and count, then stores them privately. */
export async function storeAttachments(files: File[]): Promise<Attachment[]> {
  const list = files.filter((file) => file.size > 0);
  if (list.length > MAX_ATTACHMENTS) throw new AttachmentError("tooManyFiles");
  const buffers = await Promise.all(list.map(async (file) => ({ file, buffer: Buffer.from(await file.arrayBuffer()) })));
  for (const { buffer } of buffers) {
    if (buffer.length > MAX_UPLOAD_BYTES) throw new AttachmentError("fileSize");
    if (!detectFileType(buffer)) throw new AttachmentError("fileType");
  }
  const now = new Date();
  const dir = `attachments/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const stored: Attachment[] = [];
  for (const { file, buffer } of buffers) {
    const kind = detectFileType(buffer)!;
    const path = `${dir}/${randomBytes(16).toString("hex")}.${kind.ext}`;
    await getPrivateStorage().put(path, buffer);
    stored.push({
      id: randomUUID(),
      name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || `fichier.${kind.ext}`,
      mime: kind.mime,
      size: buffer.length,
      path,
    });
  }
  return stored;
}
