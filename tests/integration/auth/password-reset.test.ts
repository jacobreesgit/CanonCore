/**
 * Integration tests for password reset flow.
 * Tests token validation, expiry, and password update with real database.
 */

import { describe, it, expect, vi } from "vitest";
import { resetPassword } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock next/headers for server action context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Bypass rate limiting for integration tests
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

describe("password reset integration", () => {
  // Each test uses unique timestamps to avoid conflicts
  const testEmail = () =>
    `reset-${Date.now()}-${Math.random().toString(36).slice(2)}@test.example.com`;

  it("resets password with valid token", async () => {
    const email = testEmail();
    const user = await prisma.user.create({
      data: { email, passwordHash: "oldhash" },
    });

    // Create a valid token
    const token = await prisma.passwordReset.create({
      data: {
        token: `valid-test-token-${Date.now()}`,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    // Reset password
    const result = await resetPassword(token.token, "NewPassword1");
    expect(result.success).toBe(true);

    // Verify password was updated
    const updatedUser = await prisma.user.findUnique({ where: { email } });
    expect(updatedUser?.passwordHash).not.toBe("oldhash");
  });

  it("rejects expired token", async () => {
    const email = testEmail();
    const user = await prisma.user.create({
      data: { email, passwordHash: "hash" },
    });

    const tokenValue = `expired-token-${Date.now()}`;
    // Create an expired token
    await prisma.passwordReset.create({
      data: {
        token: tokenValue,
        userId: user.id,
        expires: new Date(Date.now() - 1000), // Expired
      },
    });

    const result = await resetPassword(tokenValue, "NewPassword1");
    expect(result.error).toBe("Reset link has expired");
  });

  it("rejects invalid token", async () => {
    const result = await resetPassword("nonexistent-token", "NewPassword1");
    expect(result.error).toBe("Invalid or expired reset link");
  });

  it("deletes token after successful reset", async () => {
    const email = testEmail();
    const user = await prisma.user.create({
      data: { email, passwordHash: "hash" },
    });

    const tokenValue = `one-time-token-${Date.now()}`;
    await prisma.passwordReset.create({
      data: {
        token: tokenValue,
        userId: user.id,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await resetPassword(tokenValue, "NewPassword1");

    // Token should be deleted
    const deletedToken = await prisma.passwordReset.findUnique({
      where: { token: tokenValue },
    });
    expect(deletedToken).toBeNull();
  });

  it("validates password complexity on reset", async () => {
    const result = await resetPassword("any-token", "weak");
    expect(result.error).toBeDefined();
  });
});
