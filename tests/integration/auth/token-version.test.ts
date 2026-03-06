/**
 * Integration tests for token version invalidation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import "../setup";

describe("Token Version", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `tv-${Date.now()}@example.com`,
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

  it("starts at version 0", async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    expect(user?.tokenVersion).toBe(0);
  });

  it("increments on update", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tokenVersion: true },
    });
    expect(user?.tokenVersion).toBe(1);
  });
});
