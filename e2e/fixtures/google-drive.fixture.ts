/**
 * Google Drive connection fixture for E2E tests.
 * Uses E2E_GOOGLE_* env vars (jacobreesmedia@gmail.com), separate from seed account.
 */

import { testUserFixture, testPrisma as prisma } from "./test-user.fixture";
import { encryptCredential } from "@/lib/crypto";
import {
  getDriveClientFromRefreshToken,
  permanentlyDeleteFile,
  emptyTrash,
} from "@/lib/google-drive-client";

import {
  E2E_DRIVE_USER_EMAIL,
  E2E_DRIVE_USER_PASSWORD,
} from "../helpers/test-user";

export interface E2eDriveUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

export interface GoogleDriveFixture {
  /**
   * Set up a real Google Drive connection for the test user.
   * Requires GOOGLE_E2E_REFRESH_TOKEN environment variable.
   */
  setupDriveConnection: (userId: string) => Promise<string>;

  /**
   * Clean up the Google Drive connection after test.
   */
  cleanupDriveConnection: (userId: string) => Promise<void>;

  /**
   * Clean up all items for a user (removes leftover test data).
   */
  cleanupUserItems: (userId: string) => Promise<void>;

  /**
   * Clean up test folders from Google Drive (permanently deletes).
   * Keeps protected folders like "Breaking Bad".
   */
  cleanupTestDriveFolders: (protectedFolders?: string[]) => Promise<void>;

  /**
   * Get the root folder ID for the test Drive account.
   */
  testRootFolderId: string;

  /**
   * Login as the pre-created E2E Drive user (created by setup:e2e-drive).
   * This user already has "Breaking Bad" synced in the database.
   */
  e2eDriveUser: E2eDriveUser;
}

/**
 * Gets and validates required environment variables.
 * Called lazily when fixtures are used, not at module load.
 * Uses E2E_GOOGLE_* vars (jacobreesmedia@gmail.com), separate from seed account.
 */
function getRequiredEnvVars(): { refreshToken: string; rootFolderId: string } {
  const refreshToken = process.env.GOOGLE_E2E_REFRESH_TOKEN;
  const rootFolderId = process.env.GOOGLE_E2E_ROOT_FOLDER_ID;

  if (!refreshToken) {
    throw new Error(
      "GOOGLE_E2E_REFRESH_TOKEN is required for Google Drive E2E tests.\n" +
        "Run: npx tsx scripts/generate-refresh-token.ts"
    );
  }

  if (!rootFolderId) {
    throw new Error(
      "GOOGLE_E2E_ROOT_FOLDER_ID is required for Google Drive E2E tests.\n" +
        "Create a test folder in Google Drive and set its ID in .env.local"
    );
  }

  return { refreshToken, rootFolderId };
}

export const googleDriveFixture = testUserFixture.extend<GoogleDriveFixture>({
  testRootFolderId: async ({}, use) => {
    const { rootFolderId } = getRequiredEnvVars();
    await use(rootFolderId);
  },

  setupDriveConnection: async ({}, use) => {
    const createdConnections: string[] = [];

    const setup = async (userId: string): Promise<string> => {
      const { refreshToken, rootFolderId } = getRequiredEnvVars();

      const connection = await prisma.googleDriveConnection.upsert({
        where: { userId },
        update: {
          name: "E2E Test Google Drive",
          email: process.env.GOOGLE_E2E_EMAIL || "e2e-test@example.com",
          encryptedAccessToken: encryptCredential("pending-refresh"),
          encryptedRefreshToken: encryptCredential(refreshToken),
          accessTokenExpiry: new Date(0), // Force refresh on first use
          rootFolderId,
          isActive: true,
          needsReauth: false,
          lastSyncAt: null,
        },
        create: {
          userId,
          name: "E2E Test Google Drive",
          email: process.env.GOOGLE_E2E_EMAIL || "e2e-test@example.com",
          encryptedAccessToken: encryptCredential("pending-refresh"),
          encryptedRefreshToken: encryptCredential(refreshToken),
          accessTokenExpiry: new Date(0), // Force refresh on first use
          rootFolderId,
          isActive: true,
          needsReauth: false,
        },
      });

      createdConnections.push(connection.id);
      return connection.id;
    };

    await use(setup);

    // Cleanup after test
    for (const id of createdConnections) {
      await prisma.googleDriveConnection
        .delete({ where: { id } })
        .catch(() => {});
    }
  },

  cleanupDriveConnection: async ({}, use) => {
    const cleanup = async (userId: string) => {
      await prisma.googleDriveConnection.deleteMany({ where: { userId } });
    };
    await use(cleanup);
  },

  cleanupUserItems: async ({}, use) => {
    const cleanup = async (userId: string) => {
      // Delete all item files first (foreign key constraint)
      await prisma.itemFile.deleteMany({
        where: { item: { userId } },
      });
      // Then delete all items for the user
      await prisma.item.deleteMany({ where: { userId } });
    };
    await use(cleanup);
  },

  cleanupTestDriveFolders: async ({}, use) => {
    const cleanup = async (protectedFolders: string[] = ["Breaking Bad"]) => {
      const { refreshToken, rootFolderId } = getRequiredEnvVars();

      try {
        const drive = await getDriveClientFromRefreshToken(refreshToken);

        // List all folders in root folder
        const response = await drive.files.list({
          q: `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: "files(id, name)",
          pageSize: 1000,
        });

        const folders = response.data.files || [];

        // Delete all folders except protected ones
        let deletedCount = 0;
        for (const folder of folders) {
          if (folder.name && protectedFolders.includes(folder.name)) {
            continue; // Skip protected folders
          }

          if (folder.id) {
            try {
              await permanentlyDeleteFile(drive, folder.id);
              deletedCount++;
            } catch (err) {
              console.warn(
                `[E2E Cleanup] Failed to delete folder "${folder.name}":`,
                err instanceof Error ? err.message : err
              );
            }
          }
        }

        if (deletedCount > 0) {
          console.log(
            `[E2E Cleanup] Permanently deleted ${deletedCount} test folders`
          );
        }

        // Empty trash to clean up any previously trashed items
        try {
          await emptyTrash(drive);
        } catch (err) {
          console.warn(
            "[E2E Cleanup] Failed to empty trash:",
            err instanceof Error ? err.message : err
          );
        }
      } catch (err) {
        // Log but don't fail tests on cleanup errors
        console.warn(
          "[E2E Cleanup] Failed to cleanup test Drive folders:",
          err instanceof Error ? err.message : err
        );
      }
    };
    await use(cleanup);
  },

  e2eDriveUser: async ({ page }, use) => {
    // Find the pre-created E2E Drive user (created by setup:e2e-drive)
    const user = await prisma.user.findUnique({
      where: { email: E2E_DRIVE_USER_EMAIL },
    });

    if (!user) {
      throw new Error(
        `E2E Drive user not found: ${E2E_DRIVE_USER_EMAIL}\n` +
          "Run: pnpm run setup:e2e-drive"
      );
    }

    if (!user.username) {
      throw new Error(
        `E2E Drive user missing username: ${E2E_DRIVE_USER_EMAIL}\n` +
          "Run: pnpm run setup:e2e-drive (which should assign a username)"
      );
    }

    const e2eDriveUser: E2eDriveUser = {
      id: user.id,
      email: E2E_DRIVE_USER_EMAIL,
      password: E2E_DRIVE_USER_PASSWORD,
      username: user.username,
    };

    // Sign in the user via UI
    await page.goto("/sign-in");
    await page
      .getByLabel("Email")
      .waitFor({ state: "visible", timeout: 15000 });
    await page.getByLabel("Email").fill(e2eDriveUser.email);
    await page
      .getByTestId("sign-in-password-input")
      .fill(e2eDriveUser.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`/u/${e2eDriveUser.username}`, { timeout: 15000 });

    await use(e2eDriveUser);

    // No cleanup - this is a persistent user created by setup:e2e-drive
  },
});

export { prisma as drivePrisma };
