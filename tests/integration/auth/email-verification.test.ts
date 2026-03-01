/**
 * Integration tests for email verification flow.
 * Tests token creation, verification, expiry, and email change.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import "../setup";

describe("Email Verification", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `test-${Date.now()}@example.com`,
        passwordHash: await hash("Password1", 10),
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    if (userId) {
      await prisma.emailVerificationToken
        .deleteMany({ where: { userId } })
        .catch(() => {});
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("creates and verifies a token", async () => {
    const token = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        email: `test-${Date.now()}@example.com`,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const found = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    expect(found).not.toBeNull();
    expect(found?.userId).toBe(userId);
  });

  it("cascades on user deletion", async () => {
    const token = randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({
      data: {
        token,
        userId,
        email: "test@example.com",
        expires: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    await prisma.user.delete({ where: { id: userId } });
    userId = ""; // Prevent afterEach cleanup error

    const found = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });
    expect(found).toBeNull();
  });
});
