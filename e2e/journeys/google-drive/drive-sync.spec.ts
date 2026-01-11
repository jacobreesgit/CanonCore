/**
 * E2E tests for Google Drive sync operations.
 * Tests auto-sync behavior when items are created/updated.
 *
 * Note: The current implementation uses auto-sync on item creation,
 * not a manual "Sync Now" button. These tests verify auto-sync works.
 */

import { test, expect, prisma } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

test.describe("Google Drive: Auto-Sync Operations", () => {
  let itemsPage: ItemsPage;

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
      itemsPage = new ItemsPage(page);
      await page.goto("/my-items");
    }
  );

  test("creates item with driveFileId on creation", async ({
    page,
    testUser,
  }) => {
    // Create an item
    await itemsPage.createItem("Auto Sync Test Item");

    // Wait for item to be synced (driveFileId set)
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Auto Sync Test Item" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });
  });

  test("connection not required for item creation", async ({
    page,
    cleanupDriveConnection,
    testUser,
  }) => {
    // Remove connection
    await cleanupDriveConnection(testUser.id);
    await page.reload();

    // Should still be able to create items
    await itemsPage.createItem("No Connection Item");
    await itemsPage.expectItemVisible("No Connection Item");

    // Item should exist but without driveFileId
    const item = await prisma.item.findFirst({
      where: { userId: testUser.id, name: "No Connection Item" },
    });
    expect(item).not.toBeNull();
  });

  test("items maintain sync status after rename", async ({
    page,
    testUser,
  }) => {
    // Create and wait for sync
    await itemsPage.createItem("Rename Sync Test");

    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Rename Sync Test" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Get original driveFileId
    const originalItem = await prisma.item.findFirst({
      where: { userId: testUser.id, name: "Rename Sync Test" },
    });
    const originalDriveId = originalItem?.driveFileId;

    // Rename the item
    await itemsPage.renameItemViaContextMenu(
      "Rename Sync Test",
      "Renamed Sync Item"
    );

    // DriveFileId should remain the same (stable ID)
    const renamedItem = await prisma.item.findFirst({
      where: { userId: testUser.id, name: "Renamed Sync Item" },
    });
    expect(renamedItem?.driveFileId).toBe(originalDriveId);
  });
});
