import { afterAll, beforeAll, vi } from "vitest";
import dotenv from "dotenv";
import path from "path";
import type { PrismaClient } from "@prisma/client";

// Load environment variables from .env.local BEFORE importing prisma
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

// Bypass rate limiting in integration tests (uses env var approach)
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

let prisma: PrismaClient;

beforeAll(async () => {
  // Dynamic import after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;

  // Clean up any leftover test data from previous runs
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.example.com" } },
  });
});

afterAll(async () => {
  // Clean up all test data after tests complete
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.example.com" } },
  });
  await prisma.$disconnect();
});
