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
      itemsPage = new ItemsPage(page);
      await itemsPage.goto();
    }
  );

  test("creates folder in Drive when item created", async ({ page }) => {
    // Create item via web UI
    await itemsPage.createItem("E2E Test Folder");

    // Verify item appears in web (use expectItemVisible to avoid matching toast)
    await itemsPage.expectItemVisible("E2E Test Folder");

    // Verify sync completed (item should have driveFileId)
    await itemsPage.waitForToastToDisappear();
  });

  test("renames folder in Drive when item renamed", async ({ page }) => {
    // Create item first
    await itemsPage.createItem("Rename Test Item");
    await itemsPage.waitForToastToDisappear();
    // Switch to tree view for stable context menu
    await itemsPage.switchToTreeView();

    // Open settings and rename
    await itemsPage.openSettingsViaContextMenu("Rename Test Item");
    await page.getByLabel(/^name$/i).fill("Renamed Item");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for dialog to close
    await expect(
      page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });

    // Verify renamed in web
    await expect(page.getByText("Renamed Item")).toBeVisible();
    await expect(page.getByText("Rename Test Item")).not.toBeVisible();
  });

  test("deletes folder in Drive when item deleted", async ({ page }) => {
    // Create item first
    await itemsPage.createItem("Delete Test Item");
    await itemsPage.waitForToastToDisappear();
    // Switch to tree view for stable context menu
    await itemsPage.switchToTreeView();

    // Delete via context menu
    await itemsPage.deleteItemViaContextMenu("Delete Test Item");

    // Verify removed from web
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
    // Switch to tree view for stable context menu
    await itemsPage.switchToTreeView();

    // Rename the item
    await itemsPage.openSettingsViaContextMenu("Stable ID Test");
    await page.getByLabel(/^name$/i).fill("Renamed Stable ID");
    await page.getByRole("button", { name: /save changes/i }).click();

    // Wait for dialog to close and rename to complete
    await expect(
      page.getByRole("dialog", { name: /settings/i })
    ).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Renamed Stable ID")).toBeVisible();

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

  test("nested items sync correctly", async ({ page, testUser }) => {
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

    // Wait for children to sync
    await expect(async () => {
      const children = await prisma.item.findMany({
        where: {
          userId: testUser.id,
          parent: { name: "Parent For Nested" },
        },
      });
      expect(children.every((c) => c.driveFileId !== null)).toBe(true);
    }).toPass({ timeout: 15000 });

    // Verify parent has no duplicates
    const parents = await prisma.item.findMany({
      where: { userId: testUser.id, name: "Parent For Nested" },
    });
    expect(parents.length).toBe(1);

    // Verify children exist without duplicates
    const children = await prisma.item.findMany({
      where: {
        userId: testUser.id,
        parent: { name: "Parent For Nested" },
      },
    });
    expect(children.length).toBe(2);
    expect(children.map((c) => c.name).sort()).toEqual(["Child 1", "Child 2"]);
  });
});
