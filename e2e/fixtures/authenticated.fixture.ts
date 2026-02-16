/**
 * Authenticated test fixture.
 * Creates a test user via DB, signs in via UI, provides userId + POMs.
 * Cleans up user on teardown.
 */
import { test as base } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";
import { config } from "dotenv";
import { testUser as generateTestUser } from "../config/test-data";
import { Timeouts } from "../config/timeouts";

config({ path: ".env.local" });

const globalForPrisma = globalThis as unknown as {
  e2ePrisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.e2ePrisma) {
    const adapter = new PrismaPg({
      connectionString:
        process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL!,
    });
    globalForPrisma.e2ePrisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.e2ePrisma;
}

export const prisma = getPrismaClient();

export interface TestUserInfo {
  id: string;
  email: string;
  password: string;
  username: string;
}

export interface PublicUserInfo {
  id: string;
  username: string;
  itemId: string;
  itemName: string;
}

/**
 * Creates a public user with a public item in the DB.
 * Used by tests that need a public profile/item without relying on seed data.
 */
export async function createPublicUser(): Promise<PublicUserInfo> {
  const userData = generateTestUser();
  const passwordHash = await hash(userData.password, 10);
  const user = await prisma.user.create({
    data: {
      email: userData.email,
      passwordHash,
      username: userData.username,
      isPublic: true,
    },
  });
  const itemName = `public-item-${userData.username}`;
  const item = await prisma.item.create({
    data: {
      name: itemName,
      userId: user.id,
      isPublic: true,
      inheritVisibility: false,
      tmdbBackdropPath: "/test-backdrop.jpg",
    },
  });
  return {
    id: user.id,
    username: userData.username,
    itemId: item.id,
    itemName,
  };
}

/**
 * Deletes a public user and their items from the DB.
 */
export async function deletePublicUser(userId: string): Promise<void> {
  await prisma.item.deleteMany({ where: { userId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

export const authenticatedFixture = base.extend<{
  testUser: TestUserInfo;
  isMobile: boolean;
}>({
  isMobile: async ({}, use, testInfo) => {
    const viewport = testInfo.project.use.viewport;
    await use(viewport ? viewport.width < 1024 : false);
  },

  testUser: async ({ page }, use) => {
    const userData = generateTestUser();
    const passwordHash = await hash(userData.password, 10);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        username: userData.username,
      },
    });

    const testUserInfo: TestUserInfo = {
      id: user.id,
      email: userData.email,
      password: userData.password,
      username: userData.username,
    };

    // Sign in via UI
    await page.goto("/sign-in");
    const emailInput = page.getByTestId("sign-in-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(testUserInfo.email);
    await page
      .getByTestId("sign-in-password-input")
      .fill(testUserInfo.password);
    await page.getByTestId("sign-in-submit-button").click();
    await page.waitForURL(`/u/${testUserInfo.username}`, {
      timeout: Timeouts.upload,
    });

    await use(testUserInfo);

    // Cleanup: delete items first, then user
    await prisma.item
      .deleteMany({ where: { userId: user.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  },
});
