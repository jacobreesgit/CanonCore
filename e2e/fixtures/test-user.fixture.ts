/**
 * Test user fixture for E2E tests.
 * Provides authenticated test user with database ID.
 */

import { test as base } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

// Singleton Prisma client for fixtures
const globalForPrisma = globalThis as unknown as {
  e2ePrisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.e2ePrisma) {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL!,
    });
    globalForPrisma.e2ePrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.e2ePrisma;
}

const prisma = getPrismaClient();

export interface TestUserWithId {
  id: string;
  email: string;
  password: string;
}

/**
 * Generates unique test user credentials.
 */
function generateTestUserData(): { email: string; password: string } {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: "TestPassword123!",
  };
}

export const testUserFixture = base.extend<{ testUser: TestUserWithId }>({
  testUser: async ({ page }, use) => {
    // Generate unique test user
    const userData = generateTestUserData();
    const passwordHash = await hash(userData.password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
      },
    });

    const testUser: TestUserWithId = {
      id: user.id,
      email: userData.email,
      password: userData.password,
    };

    // Sign in the user via UI
    await page.goto("/sign-in");
    // Wait for sign-in form to be fully loaded (uses placeholder, not label)
    await page
      .getByPlaceholder("Email")
      .waitFor({ state: "visible", timeout: 15000 });
    await page.getByPlaceholder("Email").fill(testUser.email);
    await page.getByPlaceholder("Password").fill(testUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/my-items", { timeout: 15000 });

    await use(testUser);

    // Cleanup: Delete user and all related data (cascades)
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  },
});

export { prisma as testPrisma };
