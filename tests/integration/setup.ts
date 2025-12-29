import { beforeAll, beforeEach, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import type { PrismaClient } from "@prisma/client";

// Load environment variables from .env.local BEFORE importing prisma
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

let prisma: PrismaClient;

beforeAll(async () => {
  // Dynamic import after env vars are loaded
  const prismaModule = await import("@/lib/prisma");
  prisma = prismaModule.prisma;
});

// Clean up test data before each test
// PasswordReset has onDelete: Cascade, so deleting users cleans up everything
beforeEach(async () => {
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.example.com" } },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { contains: "@test.example.com" } },
  });
  await prisma.$disconnect();
});
