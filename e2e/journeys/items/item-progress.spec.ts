/**
 * E2E tests for item progress bars.
 * Tests progress bar visibility and behavior in grid, tree, and hero views.
 * Note: Tree view only exists on item detail pages (when viewing children).
 */

import { test, expect } from "../../fixtures";

test.describe("Item Progress Bars", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("hides progress bar when item has no media files (grid view)", async ({
    page,
    itemsPage,
  }) => {
    // Create empty folder on root profile page
    await itemsPage.createItem("Empty Folder");

    // Should not show progress bar in grid view (default on profile page)
    await expect(page.getByTestId("grid-item-progress-bar")).not.toBeVisible();
  });

  test("hides progress bar when item has no media files (tree view)", async ({
    page,
    itemsPage,
  }) => {
    // Create parent folder and navigate to it (tree view is on item detail pages)
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Create child items
    await itemsPage.createItem("Child A");
    await itemsPage.createItem("Child B");

    // Switch to tree view on item detail page
    await itemsPage.switchToTreeView();
    await expect(page.getByTestId("tree-item-progress-bar")).not.toBeVisible();
  });

  test("hides progress bar in edit mode (grid view)", async ({
    page,
    itemsPage,
  }) => {
    // Create item with unique name that won't match "Edit" button
    await itemsPage.createItem("Grid Test Item");

    // Set sort to Custom Order (required for edit mode)
    await itemsPage.selectSortOption("Custom Order");

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Progress bar should not be visible in edit mode
    await expect(page.getByTestId("grid-item-progress-bar")).not.toBeVisible();

    // Exit edit mode
    await itemsPage.exitEditMode();
  });

  // "hides progress bar in edit mode (tree view)" moved to heavy-serial.spec.ts

  test("shows hero section on item detail page", async ({
    page,
    itemsPage,
  }) => {
    // Create item
    await itemsPage.createItem("Hero Test");

    // Navigate to item detail
    await itemsPage.clickItem("Hero Test");

    // Verify hero is visible
    const hero = page.getByTestId("hero-carousel");
    await expect(hero).toBeVisible();

    // Hero progress bar should not be visible (no media files)
    await expect(page.getByTestId("hero-progress-bar")).not.toBeVisible();
  });

  // "navigates between views without progress bar errors" moved to heavy-serial.spec.ts
});
