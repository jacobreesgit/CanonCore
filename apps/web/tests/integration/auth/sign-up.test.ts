/**
 * Integration tests for sign-up flow.
 * Tests user creation with real database.
 */

import { describe, it, expect, vi } from "vitest";
import { signUp } from "@/lib/auth-actions";
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

describe("signUp integration", () => {
  const testEmail = () => `signup-${Date.now()}@test.example.com`;

  it("persists user to database", async () => {
    const email = testEmail();

    const result = await signUp(email, "Password123!");

    expect(result.success).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user?.email).toBe(email);
  });

  it("stores hashed password, not plain text", async () => {
    const email = testEmail();
    const plainPassword = "Password123!";

    await signUp(email, plainPassword);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.passwordHash).not.toBe(plainPassword);
    expect(user?.passwordHash.length).toBeGreaterThan(20);
  });

  it("prevents duplicate email registration", async () => {
    const email = testEmail();

    // First sign up should succeed
    const first = await signUp(email, "Password123!");
    expect(first.success).toBe(true);

    // Second sign up with same email should fail
    const second = await signUp(email, "DifferentPass1!");
    expect(second.error).toBe("An account with this email already exists");

    // Should still only be one user
    const users = await prisma.user.findMany({ where: { email } });
    expect(users.length).toBe(1);
  });
});
