/**
 * Extracted lockout logic for testability.
 * Used by authorize() in lib/auth.ts.
 */

/** Number of consecutive failed attempts before lockout. */
export const LOCKOUT_THRESHOLD = 5;

/** Lockout duration in milliseconds (15 minutes). */
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LockoutUser {
  lockedUntil: Date | null;
  failedLoginAttempts: number;
}

interface LockoutCheckResult {
  locked: boolean;
  remainingMinutes?: number;
}

/**
 * Checks whether a user account is currently locked.
 * Returns lockout status and remaining minutes if locked.
 */
export function isAccountLocked(user: LockoutUser): LockoutCheckResult {
  if (!user.lockedUntil) {
    return { locked: false };
  }

  const now = new Date();
  if (user.lockedUntil > now) {
    const remainingMs = user.lockedUntil.getTime() - now.getTime();
    const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
    return { locked: true, remainingMinutes };
  }

  return { locked: false };
}

/**
 * Returns Prisma update data for a failed login attempt.
 * Triggers lockout if threshold is reached.
 */
export function handleFailedLogin(user: LockoutUser): {
  failedLoginAttempts: number;
  lockedUntil?: Date;
} {
  const newAttempts = user.failedLoginAttempts + 1;
  const data: { failedLoginAttempts: number; lockedUntil?: Date } = {
    failedLoginAttempts: newAttempts,
  };
  if (newAttempts >= LOCKOUT_THRESHOLD) {
    data.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
  }
  return data;
}

/**
 * Returns Prisma update data for a successful login (resets counters).
 */
export function handleSuccessfulLogin(): {
  failedLoginAttempts: number;
  lockedUntil: null;
} {
  return { failedLoginAttempts: 0, lockedUntil: null };
}
