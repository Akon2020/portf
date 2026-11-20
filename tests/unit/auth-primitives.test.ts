import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generateToken, safeEqual, sha256 } from "@/server/auth/crypto";
import {
  checkPasswordPolicy,
  hashPassword,
  needsRehash,
  verifyDummyPassword,
  verifyPassword,
} from "@/server/auth/password";
import {
  LOCKOUT_STEPS_MINUTES,
  SESSION_POLICIES,
  computeLockout,
  initialSessionTimes,
  isSessionActive,
  nextSessionExpiry,
} from "@/server/auth/policy";
import {
  currentTotpStep,
  generateBackupCodes,
  generateTotpCode,
  generateTotpSecret,
  hashBackupCode,
  normalizeBackupCode,
  verifyTotpCode,
} from "@/server/auth/totp";

const key = randomBytes(32).toString("base64");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("crypto", () => {
  it("generates 32 byte url safe tokens", () => {
    const token = generateToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateToken()).not.toBe(token);
  });

  it("hashes tokens with sha256", () => {
    expect(sha256("abc")).toHaveLength(64);
  });

  it("compares in constant time", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });

  it("round trips AES-256-GCM with a random IV", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", key);
    const b = encryptSecret("JBSWY3DPEHPK3PXP", key);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, key)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("rejects tampered payloads and wrong keys", () => {
    const payload = encryptSecret("secret", key);
    const parts = payload.split(".");
    parts[3] = Buffer.from("other").toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow();
  });
});

describe("password", () => {
  it("hashes with Argon2id and verifies", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(needsRehash(hash)).toBe(false);
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(hash, "wrong horse battery staple")).toBe(false);
  });

  it("applies the pepper", async () => {
    const hash = await hashPassword("correct horse battery staple", "pepper-a");
    expect(await verifyPassword(hash, "correct horse battery staple", "pepper-a")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery staple", "pepper-b")).toBe(false);
  });

  it("flags legacy hashes for rehash", () => {
    expect(needsRehash("$2a$12$abcdefghijklmnopqrstuv")).toBe(true);
    expect(needsRehash("$argon2id$v=19$m=4096,t=1,p=1$c2FsdHNhbHQ$aGFzaGhhc2g")).toBe(true);
  });

  it("takes comparable time for unknown users", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await verifyDummyPassword("warm up the dummy hash");
    const t0 = performance.now();
    await verifyPassword(hash, "not the password at all");
    const real = performance.now() - t0;
    const t1 = performance.now();
    await verifyDummyPassword("not the password at all");
    const dummy = performance.now() - t1;
    expect(dummy).toBeGreaterThan(real / 3);
    expect(dummy).toBeLessThan(real * 3);
  });

  it("enforces the password policy", () => {
    expect(checkPasswordPolicy("short")).toContain("too_short");
    expect(checkPasswordPolicy("Password2024!")).toContain("common");
    expect(checkPasswordPolicy("motdepasse123")).toContain("common");
    expect(checkPasswordPolicy("aaaaaaaaaaaaaaa")).toContain("repetitive");
    expect(checkPasswordPolicy("akonkwaushindi-2026x", { email: "akonkwaushindi@gmail.com" })).toContain(
      "personal",
    );
    expect(checkPasswordPolicy("Bukavu lac Kivu soleil 7")).toEqual([]);
  });
});

describe("totp", () => {
  const secret = generateTotpSecret();
  const now = Date.UTC(2026, 10, 20, 12, 0, 0);
  const step = currentTotpStep(now);

  it("accepts the current code and neighbours within the window", () => {
    expect(verifyTotpCode(secret, generateTotpCode(secret, now), null, now)).toBe(step);
    expect(verifyTotpCode(secret, generateTotpCode(secret, now - 30_000), null, now)).toBe(step - 1);
    expect(verifyTotpCode(secret, generateTotpCode(secret, now + 30_000), null, now)).toBe(step + 1);
  });

  it("rejects codes outside the window", () => {
    expect(verifyTotpCode(secret, generateTotpCode(secret, now - 90_000), null, now)).toBeNull();
    expect(verifyTotpCode(secret, "12345", null, now)).toBeNull();
    expect(verifyTotpCode(secret, "abcdef", null, now)).toBeNull();
  });

  it("refuses a time step that was already used", () => {
    const code = generateTotpCode(secret, now);
    expect(verifyTotpCode(secret, code, step, now)).toBeNull();
    expect(verifyTotpCode(secret, code, step - 1, now)).toBe(step);
  });

  it("generates ten distinct backup codes and normalizes input", () => {
    const codes = generateBackupCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(normalizeBackupCode(" ab cde-fghij ")).toBe("ABCDEFGHIJ");
    expect(hashBackupCode(codes[0].toLowerCase())).toBe(hashBackupCode(codes[0]));
  });
});

describe("session and lockout policy", () => {
  const created = new Date("2026-11-20T10:00:00Z");
  const policy = SESSION_POLICIES.admin;
  const times = { createdAt: created, lastSeenAt: created, revokedAt: null, ...initialSessionTimes(policy, created) };

  it("expires admin sessions after 7 idle days and 30 days absolute", () => {
    expect(isSessionActive(times, new Date(created.getTime() + 6 * DAY))).toBe(true);
    expect(isSessionActive(times, new Date(created.getTime() + 7 * DAY + 1))).toBe(false);
    const extended = { ...times, expiresAt: new Date(created.getTime() + 40 * DAY) };
    expect(isSessionActive(extended, new Date(created.getTime() + 30 * DAY + 1))).toBe(false);
  });

  it("extends at most once per hour and never past the absolute limit", () => {
    expect(nextSessionExpiry(times, policy, new Date(created.getTime() + 30 * 60_000))).toBeNull();
    const later = new Date(created.getTime() + 2 * HOUR);
    expect(nextSessionExpiry(times, policy, later)?.getTime()).toBe(later.getTime() + 7 * DAY);
    const nearEnd = new Date(created.getTime() + 29 * DAY);
    const seen = { ...times, lastSeenAt: new Date(nearEnd.getTime() - 2 * HOUR) };
    expect(nextSessionExpiry(seen, policy, nearEnd)?.getTime()).toBe(times.absoluteExpiresAt.getTime());
  });

  it("revoked sessions are inactive", () => {
    expect(isSessionActive({ ...times, revokedAt: created }, created)).toBe(false);
  });

  it("locks progressively after five failures", () => {
    expect(computeLockout(4, 0)).toBeNull();
    const minutes = [0, 1, 2, 3, 4].map((level) => computeLockout(5, level)!.minutes);
    expect(minutes).toEqual([...LOCKOUT_STEPS_MINUTES, 60]);
  });
});
