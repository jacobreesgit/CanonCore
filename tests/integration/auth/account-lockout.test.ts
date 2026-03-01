/**
 * Integration tests for account lockout.
 * Tests DB field tracking and checkSignInStatus server action.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import "../setup";

// Mock next/headers for server action context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Bypass rate limiting for integration tests
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

describe("Account Lockout", () => {
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    userEmail = `lockout-${Date.now()}@example.com`;
    const user = await prisma.user.create({
      data: {
        email: userEmail,
        passwordHash: await hash("Password1", 10),
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("tracks failed login attempts", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 3 },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { failedLoginAttempts: true },
    });
    expect(user?.failedLoginAttempts).toBe(3);
  });

  it("sets and clears lockout", async () => {
    const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 5, lockedUntil: lockUntil },
    });

    const locked = await prisma.user.findUnique({
      where: { id: userId },
      select: { lockedUntil: true },
    });
    expect(locked?.lockedUntil).toEqual(lockUntil);

    // Clear lockout
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    const unlocked = await prisma.user.findUnique({
      where: { id: userId },
      select: { lockedUntil: true, failedLoginAttempts: true },
    });
    expect(unlocked?.lockedUntil).toBeNull();
    expect(unlocked?.failedLoginAttempts).toBe(0);
  });

  it("checkSignInStatus returns locked for locked account", async () => {
    const { checkSignInStatus } = await import("@/lib/auth-actions");
    const lockUntil = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 5, lockedUntil: lockUntil },
    });

    const result = await checkSignInStatus(userEmail);
    expect(result.status).toBe("locked");
    expect(result.remainingMinutes).toBeGreaterThan(0);
  });

  it("checkSignInStatus returns ok for unknown email (anti-enumeration)", async () => {
    const { checkSignInStatus } = await import("@/lib/auth-actions");
    const result = await checkSignInStatus("nonexistent@example.com");
    expect(result.status).toBe("ok");
  });
});
