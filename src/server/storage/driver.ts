import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Readable } from "node:stream";

export interface StoredFileInfo {
  size: number;
  modifiedAt: Date;
}

/** Storage abstraction: local disk now, S3 compatible (Cloudflare R2) later. */
export interface StorageDriver {
  put(path: string, data: Buffer): Promise<void>;
  stat(path: string): Promise<StoredFileInfo | null>;
  read(path: string): Readable;
  remove(path: string): Promise<void>;
}

/** Uploads live outside the application folder so they survive deployments. */
export function uploadsRoot(): string {
  return resolve(process.env.UPLOADS_DIR ?? `${process.env.DATA_DIR ?? "./portfolio_data"}/uploads`);
}

const SAFE_PATH = /^[a-z0-9][a-z0-9/_.-]*$/i;

/** Resolves a relative storage path and refuses anything escaping the root. */
export function safeResolve(root: string, relativePath: string): string | null {
  if (!SAFE_PATH.test(relativePath) || relativePath.includes("..") || relativePath.includes("//")) return null;
  const full = resolve(root, relativePath);
  return full.startsWith(root + sep) ? full : null;
}

export class LocalStorageDriver implements StorageDriver {
  constructor(private readonly root = uploadsRoot()) {}

  private full(path: string): string {
    const full = safeResolve(this.root, path);
    if (!full) throw new Error(`Chemin de stockage refusé : ${path}`);
    return full;
  }

  async put(path: string, data: Buffer): Promise<void> {
    const full = this.full(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data, { mode: 0o644 });
  }

  async stat(path: string): Promise<StoredFileInfo | null> {
    const full = safeResolve(this.root, path);
    if (!full) return null;
    try {
      const info = await stat(full);
      return info.isFile() ? { size: info.size, modifiedAt: info.mtime } : null;
    } catch {
      return null;
    }
  }

  read(path: string): Readable {
    return createReadStream(this.full(path));
  }

  async remove(path: string): Promise<void> {
    await rm(this.full(path), { force: true });
  }
}

let driver: StorageDriver | undefined;

export function getStorage(): StorageDriver {
  if (!driver) {
    if ((process.env.STORAGE_DRIVER ?? "local") !== "local") {
      throw new Error("Seul le pilote de stockage local est disponible pour le moment");
    }
    driver = new LocalStorageDriver();
  }
  return driver;
}
