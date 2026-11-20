import { hash, parseOptions, verify } from "@node-rs/argon2";
import { COMMON_PASSWORD_BASES } from "./common-passwords";
import { generateToken } from "./crypto";

/** Argon2id, OWASP baseline parameters (19 MiB, 2 iterations, 1 lane). */
export const ARGON2_PARAMS = {
  // Algorithm.Argon2id, written as a literal because the enum is a const enum.
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 256;

function argonOptions(pepper?: string) {
  return {
    ...ARGON2_PARAMS,
    secret: pepper ? Buffer.from(pepper, "utf8") : undefined,
  };
}

function pepper(): string | undefined {
  return process.env.AUTH_PEPPER || undefined;
}

export async function hashPassword(password: string, secret = pepper()): Promise<string> {
  return hash(password.normalize("NFKC"), argonOptions(secret));
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
  secret = pepper(),
): Promise<boolean> {
  try {
    return await verify(passwordHash, password.normalize("NFKC"), argonOptions(secret));
  } catch {
    return false;
  }
}

/** True when a stored hash uses weaker parameters than the current ones. */
export function needsRehash(passwordHash: string): boolean {
  if (!passwordHash.startsWith("$argon2id$")) return true;
  try {
    const options = parseOptions(passwordHash);
    return (
      options.memoryCost < ARGON2_PARAMS.memoryCost ||
      options.timeCost < ARGON2_PARAMS.timeCost ||
      options.parallelism !== ARGON2_PARAMS.parallelism
    );
  } catch {
    return true;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Runs a full verification against a throwaway hash so that a login with an
 * unknown e-mail takes the same time as one with a wrong password.
 */
export async function verifyDummyPassword(password: string): Promise<false> {
  dummyHash ??= hashPassword(generateToken(24));
  await verifyPassword(await dummyHash, password);
  return false;
}

export type PasswordIssue = "too_short" | "too_long" | "common" | "personal" | "repetitive";

export const PASSWORD_ISSUE_MESSAGES: Record<PasswordIssue, string> = {
  too_short: `Au moins ${PASSWORD_MIN_LENGTH} caractères.`,
  too_long: `Au plus ${PASSWORD_MAX_LENGTH} caractères.`,
  common: "Ce mot de passe est trop courant.",
  personal: "Le mot de passe ne doit pas contenir votre nom ou votre e-mail.",
  repetitive: "Le mot de passe est trop répétitif ou trop prévisible.",
};

function baseWord(password: string): string {
  return password
    .toLowerCase()
    .replace(/[\d\W_]+$/u, "")
    .replace(/^[\d\W_]+/u, "");
}

/** Server side password policy. Returns an empty array when the password is acceptable. */
export function checkPasswordPolicy(
  password: string,
  context: { email?: string; name?: string } = {},
): PasswordIssue[] {
  const issues: PasswordIssue[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) issues.push("too_short");
  if (password.length > PASSWORD_MAX_LENGTH) issues.push("too_long");

  const lower = password.toLowerCase();
  if (COMMON_PASSWORD_BASES.has(lower) || COMMON_PASSWORD_BASES.has(baseWord(password))) {
    issues.push("common");
  }

  const personalParts = [
    context.email?.split("@")[0],
    ...(context.name?.split(/\s+/) ?? []),
  ]
    .map((part) => part?.toLowerCase().trim())
    .filter((part): part is string => !!part && part.length >= 4);
  if (personalParts.some((part) => lower.includes(part))) issues.push("personal");

  const uniqueChars = new Set(lower).size;
  if (uniqueChars <= 3) issues.push("repetitive");

  return issues;
}
