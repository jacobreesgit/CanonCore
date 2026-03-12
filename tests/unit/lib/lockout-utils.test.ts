import { describe, it, expect } from "vitest";
import {
  isAccountLocked,
  handleFailedLogin,
  handleSuccessfulLogin,
  LOCKOUT_THRESHOLD,
} from "@/lib/lockout-utils";

describe("isAccountLocked", () => {
  it("returns unlocked when lockedUntil is null", () => {
    const result = isAccountLocked({
      lockedUntil: null,
      failedLoginAttempts: 0,
    });
    expect(result.locked).toBe(false);
  });

  it("returns locked with remaining minutes for active lockout", () => {
    const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    const result = isAccountLocked({
      lockedUntil: futureDate,
      failedLoginAttempts: 5,
    });
    expect(result.locked).toBe(true);
    expect(result.remainingMinutes).toBeGreaterThan(0);
    expect(result.remainingMinutes).toBeLessThanOrEqual(10);
  });

  it("returns unlocked for expired lockout", () => {
    const pastDate = new Date(Date.now() - 60 * 1000); // 1 min ago
    const result = isAccountLocked({
      lockedUntil: pastDate,
      failedLoginAttempts: 5,
    });
    expect(result.locked).toBe(false);
  });
});

describe("handleFailedLogin", () => {
  it("increments failed attempts", () => {
    const result = handleFailedLogin({
      lockedUntil: null,
      failedLoginAttempts: 2,
    });
    expect(result.failedLoginAttempts).toBe(3);
    expect(result.lockedUntil).toBeUndefined();
  });

  it("triggers lockout at threshold", () => {
    const result = handleFailedLogin({
      lockedUntil: null,
      failedLoginAttempts: LOCKOUT_THRESHOLD - 1,
    });
    expect(result.failedLoginAttempts).toBe(LOCKOUT_THRESHOLD);
    expect(result.lockedUntil).toBeInstanceOf(Date);
  });
});

describe("handleSuccessfulLogin", () => {
  it("resets counters", () => {
    const result = handleSuccessfulLogin();
    expect(result.failedLoginAttempts).toBe(0);
    expect(result.lockedUntil).toBeNull();
  });
});
