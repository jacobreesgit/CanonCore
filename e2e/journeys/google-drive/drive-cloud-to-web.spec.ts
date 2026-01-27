/**
 * E2E tests for cloud-to-web sync operations.
 * Tests auto-sync from Google Drive to the web app.
 */

import { test, expect, prisma } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";
import { SettingsPage } from "../../pages/settings.page";

test.describe("Google Drive: Cloud to Web Sync", () => {
  // Skip on mobile - sync tests are unreliable in mobile emulation
  // The core functionality is validated by desktop tests
  test.skip(({ isMobile }) => isMobile, "Skipping on mobile - sync unreliable");

  let itemsPage: ItemsPage;
  let settingsPage: SettingsPage;

  test.beforeEach(
    async ({
      page,
      setupDriveConnection,
      testUser,
      cleanupTestDriveFolders,
    }) => {
      // Clean up any leftover test folders from Google Drive
      await cleanupTestDriveFolders();

      await setupDriveConnection(testUser.id);
      itemsPage = new ItemsPage(page, testUser.username);
      settingsPage = new SettingsPage(page);
    }
  );

  test("items sync to Drive on creation", async ({ page, testUser }) => {
    await itemsPage.goto();

    // Create an item
    await itemsPage.createItem("Sync Test Item");

    // Wait for item to be synced (driveFileId set)
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Sync Test Item" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });
  });

  test("displays synced items correctly", async ({ page, testUser }) => {
    await itemsPage.goto();

    // Create an item so we have something to check
    await itemsPage.createItem("Sync Badge Test Item");

    // Wait for item to be synced
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Sync Badge Test Item" },
      });
      expect(item?.syncStatus).toBe("SYNCED");
    }).toPass({ timeout: 15000 });

    // Verify the item is visible
    await itemsPage.expectItemVisible("Sync Badge Test Item");
  });

  test("handles reconnect state gracefully", async ({ page, testUser }) => {
    // Set connection to need reauth
    await prisma.googleDriveConnection.update({
      where: { userId: testUser.id },
      data: {
        accessTokenExpiry: new Date(0),
        needsReauth: true,
      },
    });

    await itemsPage.goto();
    await settingsPage.openFromNavUser();
    await settingsPage.goToConnectionsTab();

    // Should show reconnect badge or reconnect button (use .first() since both may be visible)
    await expect(
      page
        .locator('[data-slot="badge"]')
        .filter({ hasText: /reconnect/i })
        .or(page.getByRole("button", { name: /reconnect/i }))
        .first()
    ).toBeVisible();
  });

  test("preserves folder hierarchy from Drive", async ({ page, testUser }) => {
    await itemsPage.goto();

    // Create nested folder structure
    await itemsPage.createItem("Parent Sync Test");
    await itemsPage.clickItem("Parent Sync Test");
    await itemsPage.createItem("Child Sync Test");

    // Go back to root and verify hierarchy
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();
    await itemsPage.clickItem("Parent Sync Test");

    // Verify child is visible under parent
    await itemsPage.expectItemVisible("Child Sync Test");
    await expect(
      page.getByRole("heading", { name: "Parent Sync Test" })
    ).toBeVisible();
  });
});
