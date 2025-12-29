/**
 * Database fixtures for E2E tests.
 *
 * Uses Prisma to directly seed and cleanup test users in the database.
 * This allows for reliable, fast test setup without hitting external APIs.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";

// Load environment variables from .env.local
config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

export interface TestUser {
  email: string;
  password: string;
}

/**
 * Generates unique test user credentials.
 * The timestamp ensures uniqueness across test runs.
 */
export function generateTestUser(): TestUser {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: "TestPassword123!",
  };
}

/**
 * Seeds a test user directly in the database.
 * Returns the created user's email for reference.
 */
export async function seedTestUser(
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
