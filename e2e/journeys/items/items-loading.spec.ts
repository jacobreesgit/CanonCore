/**
 * E2E tests for items loading behavior.
 * Verifies that content renders correctly after hydration.
 * Note: Root profile page is always grid view. Tree view is only on item detail pages.
 */

import { test, expect } from "../../fixtures";

test.describe("Items Loading", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("content renders on root page", async ({ itemsPage }) => {
    // Wait for content to be ready
    await itemsPage.waitForLoadingComplete();

    // Root profile page shows grid view or empty state
    await expect(
      itemsPage.emptyState.or(itemsPage.gridView).first()
    ).toBeVisible();
  });

  test("grid view renders after navigation on root page", async ({
    itemsPage,
  }) => {
    // Navigate and wait for content
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Root page shows grid view or empty state
    await expect(
      itemsPage.gridView.or(itemsPage.emptyState).first()
    ).toBeVisible();
  });

  test("navigation to item detail shows content", async ({ itemsPage }) => {
    // Create a test item
    await itemsPage.waitForLoadingComplete();
    await itemsPage.createItem("Loading Test Item");

    // Navigate to item detail
    await itemsPage.clickItem("Loading Test Item");

    // Verify content is ready
    await expect(itemsPage.heroSection).toBeVisible();
  });

  test("switching view modes on item detail page", async ({
    page,
    itemsPage,
  }) => {
    // Create parent item and navigate to it (view toggle is on item detail pages)
    await itemsPage.createItem("View Switch Parent");
    await itemsPage.clickItem("View Switch Parent");

    // Create children to display
    await itemsPage.createItem("View Switch Child A");
    await itemsPage.createItem("View Switch Child B");

    // Start in grid view (default)
    await expect(itemsPage.gridView).toBeVisible();

    // Switch to tree view
    await itemsPage.switchToTreeView();
    await expect(itemsPage.treeView).toBeVisible();

    // Switch back to grid view
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();
  });
});
