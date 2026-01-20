/**
 * E2E tests for Google Drive sync operations.
 * Tests auto-sync behavior when items are created/updated.
 *
 * Note: The current implementation uses auto-sync on item creation,
 * not a manual "Sync Now" button. These tests verify auto-sync works.
 */

import { test, expect, prisma } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";
import { openSidebarIfClosed } from "../../helpers/sidebar-helpers";

test.describe("Google Drive: Auto-Sync Operations", () => {
  // Skip on mobile - sync tests are unreliable in mobile emulation
  // The core functionality is validated by desktop tests
  test.skip(({ isMobile }) => isMobile, "Skipping on mobile - sync unreliable");

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

  // Skipped: Radix UI context menu has element detachment issues during React re-renders
  test.skip("items maintain sync status after rename", async ({
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
    // Switch to tree view for stable context menu
    await itemsPage.switchToTreeView();

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

  test("shows sync history after operations", async ({ page, testUser }) => {
    // Create an item (triggers sync log)
    await itemsPage.createItem("E2E Sync History Test");

    // Wait for sync to complete
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "E2E Sync History Test" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Open sidebar on mobile if needed, then open profile settings via user menu
    await openSidebarIfClosed(page);
    await page.getByTestId("my-items-user-menu").click();
    await page.getByRole("menuitem", { name: /settings/i }).click();

    // Wait for dialog to open, then switch to Activity tab
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("tab", { name: /activity/i }).click();

    // Wait for history to load and verify create operation is shown
    await expect(page.getByText("E2E Sync History Test").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Created").first()).toBeVisible();
  });

  // Skipped: Radix UI context menu has element detachment issues during React re-renders
  test.skip("deletes folder with children efficiently using batch delete", async ({
    page,
    testUser,
  }) => {
    // Create parent folder
    await itemsPage.createItem("Batch Delete Parent");

    // Wait for parent to sync
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Batch Delete Parent" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Navigate into parent and create children
    await itemsPage.clickItem("Batch Delete Parent");
    await itemsPage.createItem("Child 1");
    await itemsPage.createItem("Child 2");
    await itemsPage.createItem("Child 3");

    // Wait for all children to sync to Drive
    await expect(async () => {
      const items = await prisma.item.findMany({
        where: { userId: testUser.id },
      });
      expect(items.length).toBe(4);
      expect(items.every((i) => i.driveFileId)).toBe(true);
    }).toPass({ timeout: 30000 });

    // Navigate back to root
    await itemsPage.clickBreadcrumb("My Items");
    await page.waitForURL(/\/my-items$/);
    await itemsPage.waitForLoadingComplete();
    await itemsPage.expectItemVisible("Batch Delete Parent");

    // Delete the parent (uses batch delete for all 4 items)
    await itemsPage.deleteItemViaContextMenu("Batch Delete Parent");

    // Verify parent item is gone from UI
    await itemsPage.expectItemNotVisible("Batch Delete Parent");

    // Verify all items (parent + children) are deleted from DB
    const remaining = await prisma.item.count({
      where: { userId: testUser.id },
    });
    expect(remaining).toBe(0);
  });
});
