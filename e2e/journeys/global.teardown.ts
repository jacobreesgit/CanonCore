/**
 * Global teardown for E2E tests.
 * Cleans up orphaned test users after all tests complete.
 */

import { test as teardown } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

function getTeardownPrisma(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

teardown("global teardown", async () => {
  // Clean up any orphaned test users left from failed or interrupted tests.
  // This runs after ALL tests complete, so it's safe to delete all @example.com users.
  const prisma = getTeardownPrisma();
  try {
    const result = await prisma.user.deleteMany({
      where: {
        email: { contains: "@example.com" },
      },
    });

    if (result.count > 0) {
      console.log(
        `[E2E Teardown] Cleaned up ${result.count} orphaned test users`
      );
    }
  } catch {
    // Don't fail teardown on cleanup errors
  } finally {
    await prisma.$disconnect();
  }

  console.log("[E2E Teardown] Complete");
});
