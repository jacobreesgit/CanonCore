/**
 * E2E tests for items view toggle.
 * Tests switching between tree and grid views.
 *
 * Note: Tree view is only available on item detail pages (when viewing children).
 */

import { test, expect } from "../../fixtures";

test.describe("Items View Toggle Journey", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can switch between tree and grid view", async ({ itemsPage }) => {
    // Create parent container and navigate into it (tree view only on item detail pages)
    await itemsPage.createItem("View Container");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("View Container");

    // Create some test items inside the container
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.waitForToastToDisappear();

    // Default is grid view on item detail pages
    await expect(itemsPage.gridView).toBeVisible();

    // Switch to tree (available on item detail pages)
    await itemsPage.switchToTreeView();
    await expect(itemsPage.treeView).toBeVisible();

    // Switch back to grid
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();
  });

  test("view preference persists across navigation", async ({
    page,
    itemsPage,
  }) => {
    // Create parent container and navigate into it (tree view only on item detail pages)
    await itemsPage.createItem("Persist Container");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Persist Container");

    // Create some test items inside the container
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.waitForToastToDisappear();
    await page.waitForLoadState("networkidle");

    // Switch to grid
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();

    // Navigate away and back (wait for full page load)
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(itemsPage.gridView).toBeVisible();
  });

  test("items visible in both views", async ({ itemsPage }) => {
    // Create parent container and navigate into it (tree view only on item detail pages)
    await itemsPage.createItem("Visibility Container");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("Visibility Container");

    // Create some test items inside the container
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.waitForToastToDisappear();

    // Check grid view (default on item detail pages)
    await itemsPage.expectItemVisible("Folder A");
    await itemsPage.expectItemVisible("Folder B");

    // Check tree view (available on item detail pages)
    await itemsPage.switchToTreeView();
    await itemsPage.expectItemVisible("Folder A");
    await itemsPage.expectItemVisible("Folder B");
  });
});
