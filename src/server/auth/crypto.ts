import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** Random URL safe token, 32 bytes by default. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant time string comparison, also when lengths differ. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

const CIPHER = "aes-256-gcm";
const VERSION = "v1";

function readKey(key: string | Buffer): Buffer {
  const buffer = typeof key === "string" ? Buffer.from(key, "base64") : key;
  if (buffer.length !== 32) throw new Error("La clé de chiffrement doit faire 32 octets");
  return buffer;
}

/** AES-256-GCM with a random IV per value. Output: v1.iv.tag.ciphertext (base64url). */
export function encryptSecret(plaintext: string, key: string | Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, readKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, encrypted].map((part) =>
    typeof part === "string" ? part : part.toString("base64url"),
  ).join(".");
}

export function decryptSecret(payload: string, key: string | Buffer): string {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== VERSION || !iv || !tag || encrypted === undefined) {
    throw new Error("Format de secret chiffré invalide");
  }
  const decipher = createDecipheriv(CIPHER, readKey(key), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
