import type { SessionKind } from "../db/schema";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface SessionPolicy {
  /** Sliding lifetime extended on activity. */
  sliding: number;
  /** Hard limit from creation. */
  absolute: number;
  /** Minimum delay between two extensions, to limit database writes. */
  renewEvery: number;
}

export const SESSION_POLICIES: Record<SessionKind | "pending_2fa" | "pending_setup", SessionPolicy> = {
  admin: { sliding: 7 * DAY, absolute: 30 * DAY, renewEvery: HOUR },
  client: { sliding: 30 * DAY, absolute: 90 * DAY, renewEvery: HOUR },
  pending_2fa: { sliding: 5 * MINUTE, absolute: 5 * MINUTE, renewEvery: Infinity },
  pending_setup: { sliding: 15 * MINUTE, absolute: 15 * MINUTE, renewEvery: Infinity },
};

export interface SessionTimes {
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
}

export function initialSessionTimes(policy: SessionPolicy, now = new Date()) {
  return {
    expiresAt: new Date(now.getTime() + policy.sliding),
    absoluteExpiresAt: new Date(now.getTime() + policy.absolute),
  };
}

export function isSessionActive(session: SessionTimes, now = new Date()): boolean {
  if (session.revokedAt) return false;
  return now < session.expiresAt && now < session.absoluteExpiresAt;
}

/** Returns the new expiry when the session should be extended, otherwise null. */
export function nextSessionExpiry(
  session: SessionTimes,
  policy: SessionPolicy,
  now = new Date(),
): Date | null {
  if (now.getTime() - session.lastSeenAt.getTime() < policy.renewEvery) return null;
  const sliding = now.getTime() + policy.sliding;
  return new Date(Math.min(sliding, session.absoluteExpiresAt.getTime()));
}

// Progressive account lockout

export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_STEPS_MINUTES = [1, 5, 15, 60] as const;

/**
 * Called after a failed password check with the updated failure count.
 * Every LOCKOUT_THRESHOLD consecutive failures lock the account for the next step.
 */
export function computeLockout(failedCount: number, level: number, now = new Date()) {
  if (failedCount < LOCKOUT_THRESHOLD) return null;
  const step = LOCKOUT_STEPS_MINUTES[Math.min(level, LOCKOUT_STEPS_MINUTES.length - 1)];
  return {
    lockedUntil: new Date(now.getTime() + step * MINUTE),
    lockoutLevel: level + 1,
    failedLoginCount: 0,
    minutes: step,
  };
}
