/**
 * Database fixtures for E2E tests.
 *
 * Uses Prisma to directly create and cleanup test users in the database.
 * This allows for reliable, fast test setup without hitting external APIs.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { generateTestUserData, TEST_PASSWORD } from "../helpers/test-user";

// Load environment variables from .env.local
config({ path: ".env.local" });

/**
 * Singleton PrismaClient instance for E2E tests.
 * Ensures only one database connection is created across all test imports.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

const prisma = getPrismaClient();

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Generates unique test user credentials.
 * Delegates to shared helper for consistency.
 */
export function generateTestUser(): TestUser {
  return generateTestUserData();
}

/**
 * Creates a test user directly in the database.
 * Returns the created user's email for reference.
 */
export async function createTestUser(
  email: string,
  password: string
): Promise<void> {
  const passwordHash = await hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
  });
}

/**
 * Cleans up a specific test user from the database.
 */
export async function cleanupTestUser(email: string): Promise<void> {
  await prisma.user.deleteMany({
    where: { email },
  });
}

/**
 * Cleans up all test users (those with emails containing 'test-').
 * Useful for global cleanup after test runs.
 */
export async function cleanupAllTestUsers(): Promise<void> {
  await prisma.user.deleteMany({
    where: {
      email: {
        contains: "test-",
      },
    },
  });
}

/**
 * Disconnects the Prisma client.
 * Should be called after all tests complete.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
