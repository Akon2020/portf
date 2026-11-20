import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";
import { randomInt } from "node:crypto";
import { sha256 } from "./crypto";

export const TOTP_ISSUER = "Isaac Akonkwa Admin";
export const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;

export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function buildTotp(secretBase32: string, label: string): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

export function totpUri(secretBase32: string, label: string): string {
  return buildTotp(secretBase32, label).toString();
}

export async function totpQrDataUrl(secretBase32: string, label: string): Promise<string> {
  return QRCode.toDataURL(totpUri(secretBase32, label), { margin: 1, width: 240 });
}

export function currentTotpStep(timestamp = Date.now()): number {
  return TOTP.counter({ period: TOTP_PERIOD, timestamp });
}

/**
 * Validates a 6 digit code within a window of plus or minus one step.
 * Returns the matched time step, or null. Steps at or before lastUsedStep are
 * rejected so a code can never be replayed.
 */
export function verifyTotpCode(
  secretBase32: string,
  code: string,
  lastUsedStep: number | null,
  timestamp = Date.now(),
): number | null {
  const token = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return null;
  const delta = TOTP.validate({
    token,
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    timestamp,
    window: TOTP_WINDOW,
    afterCounter: lastUsedStep ?? undefined,
  });
  if (delta === null) return null;
  return currentTotpStep(timestamp) + delta;
}

/** Generates a code for tests and for the local development helper. */
export function generateTotpCode(secretBase32: string, timestamp = Date.now()): string {
  return TOTP.generate({
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    timestamp,
  });
}

// Backup codes

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const BACKUP_CODE_COUNT = 10;

export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashBackupCode(code: string): string {
  return sha256(`backup:${normalizeBackupCode(code)}`);
}

export function looksLikeBackupCode(code: string): boolean {
  return normalizeBackupCode(code).length === 10;
}
