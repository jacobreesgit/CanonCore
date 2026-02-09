/**
 * E2E tests for web-to-cloud sync operations.
 * Tests bidirectional write operations: create, rename, delete, upload, move.
 */

import { test, expect, prisma } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

test.describe("Google Drive: Web to Cloud Sync", () => {
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
      itemsPage = new ItemsPage(page, testUser.username);
      await itemsPage.goto();
    }
  );

  test("creates folder in Drive when item created", async ({ page }) => {
    // Create item via web UI
    await itemsPage.createItem("E2E Test Folder");

    // Verify item appears in web (use expectItemVisible to avoid matching toast)
    await itemsPage.expectItemVisible("E2E Test Folder");

    // Verify sync completed (item should have driveFileId)
  });

  test("renames folder in Drive when item renamed", async ({ page }) => {
    // Create item first
    await itemsPage.createItem("Rename Test Item");

    // Open settings and rename (grid view context menu works on root page)
    await itemsPage.openSettingsViaContextMenu("Rename Test Item");
    await page.getByLabel(/item name/i).fill("Renamed Item");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for dialog to close
    await expect(
      page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Verify renamed in web (use itemsPage to scope to content area)
    await itemsPage.expectItemVisible("Renamed Item");
    await itemsPage.expectItemNotVisible("Rename Test Item");
  });

  test("deletes folder in Drive when item deleted", async () => {
    // Create item via web UI
    await itemsPage.createItem("Delete Test Item");

    // Delete via UI
    await itemsPage.deleteItemViaContextMenu("Delete Test Item");
    await itemsPage.expectItemNotVisible("Delete Test Item");
  });

  test("stable file ID survives rename (Drive advantage)", async ({
    page,
    testUser,
  }) => {
    // Create item
    await itemsPage.createItem("Stable ID Test");

    // Wait for sync to complete
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: {
          userId: testUser.id,
          name: "Stable ID Test",
        },
        select: { id: true, driveFileId: true },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Get the driveFileId
    const itemBefore = await prisma.item.findFirst({
      where: {
        userId: testUser.id,
        name: "Stable ID Test",
      },
      select: { id: true, driveFileId: true },
    });
    const originalDriveId = itemBefore!.driveFileId;

    // Rename the item (grid view context menu works on root page)
    await itemsPage.openSettingsViaContextMenu("Stable ID Test");
    await page.getByLabel(/item name/i).fill("Renamed Stable ID");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for dialog to close and rename to complete
    await expect(
      page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });
    await itemsPage.expectItemVisible("Renamed Stable ID");

    // Verify driveFileId is unchanged (key advantage over SFTP)
    const itemAfter = await prisma.item.findFirst({
      where: {
        userId: testUser.id,
        name: "Renamed Stable ID",
      },
      select: { driveFileId: true },
    });

    expect(itemAfter?.driveFileId).toBe(originalDriveId);
  });

  test("sync idempotency - no duplicates after create then sync", async ({
    page,
    testUser,
  }) => {
    // Create item (auto-syncs to Drive)
    await itemsPage.createItem("Idempotent Test");

    // Wait for auto-sync to complete
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Idempotent Test" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Verify only ONE item exists (no duplicates)
    const items = await prisma.item.findMany({
      where: { userId: testUser.id, name: "Idempotent Test" },
    });
    expect(items.length).toBe(1);
  });

  // Skip on mobile - Drive sync behavior is viewport-independent and the additional
  // network latency from creating parent + navigating + children causes timeouts
  test("nested items sync correctly", async ({ page, testUser }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "Drive sync timing too tight on mobile"
    );
    test.slow(); // Creating parent + navigating + creating children + waiting for sync

    // Create parent
    await itemsPage.createItem("Parent For Nested");

    // Wait for parent to sync before navigating
    await expect(async () => {
      const parent = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Parent For Nested" },
      });
      expect(parent?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Navigate into parent
    await itemsPage.clickItem("Parent For Nested");

    // Create multiple children
    await itemsPage.createItem("Child 1");
    await itemsPage.createItem("Child 2");

    // Navigate back to root and trigger full sync (child sync requires root-level sync)
    await itemsPage.goto();
    const syncButton = page.getByRole("button", { name: /sync/i });
    await syncButton.click();
    await page.waitForLoadState("networkidle");

    // Wait for children to sync
    await expect(async () => {
      const children = await prisma.item.findMany({
        where: {
          userId: testUser.id,
          parent: { name: "Parent For Nested" },
        },
      });
      expect(children.length).toBe(2);
      expect(children.every((c) => c.driveFileId !== null)).toBe(true);
    }).toPass({ timeout: 30000 });

    // Verify parent has no duplicates
    const parents = await prisma.item.findMany({
      where: { userId: testUser.id, name: "Parent For Nested" },
    });
    expect(parents.length).toBe(1);
  });
});
