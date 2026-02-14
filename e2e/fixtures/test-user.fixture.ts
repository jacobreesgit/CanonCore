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
  username: string;
}

/**
 * Generates unique test user credentials.
 */
function generateTestUserData(): {
  email: string;
  password: string;
  username: string;
} {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return {
    email: `test-${timestamp}-${random}@example.com`,
    password: "TestPassword123!",
    // Username max is 20 chars, use short prefix with random suffix
    username: `tu_${random}`,
  };
}

export const testUserFixture = base.extend<{ testUser: TestUserWithId }>({
  testUser: async ({ page }, use) => {
    // Generate unique test user
    const userData = generateTestUserData();
    const passwordHash = await hash(userData.password, 10);

    // Create user in database with username
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        username: userData.username,
      },
    });

    const testUser: TestUserWithId = {
      id: user.id,
      email: userData.email,
      password: userData.password,
      username: userData.username,
    };

    // Sign in the user via UI
    await page.goto("/sign-in");
    await page.waitForLoadState("networkidle");

    // Wait for sign-in form to be fully loaded and use testId selectors for reliability
    const emailInput = page.getByTestId("sign-in-email-input");
    const passwordInput = page.getByTestId("sign-in-password-input");
    const submitButton = page.getByTestId("sign-in-submit-button");

    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await emailInput.fill(testUser.email);
    await passwordInput.fill(testUser.password);
    await submitButton.click();
    await page.waitForLoadState("networkidle");

    // Sign-in redirects to user's profile
    await page.waitForURL(`/u/${testUser.username}`, { timeout: 15000 });

    await use(testUser);

    // Cleanup: Delete user and all related data (cascades)
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  },
});

export { prisma as testPrisma };
