/**
 * E2E tests for items loading behavior.
 * Verifies that the loading spinner prevents view flash during hydration.
 * Note: Root profile page is always grid view. Tree view is only on item detail pages.
 */

import { test, expect } from "../../fixtures";

test.describe("Items Loading Spinner", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("loading spinner clears before content renders", async ({
    itemsPage,
  }) => {
    // Wait for loading to complete
    await itemsPage.waitForLoadingComplete();

    // Verify spinner is hidden and content is visible
    await itemsPage.expectLoadingHidden();
    // Root profile page shows grid view or empty state
    await expect(
      itemsPage.emptyState.or(itemsPage.gridView).first()
    ).toBeVisible();
  });

  test("does not show both loading and view simultaneously", async ({
    itemsPage,
  }) => {
    // Navigate to items page
    await itemsPage.goto();

    // At any point, we should not see loading spinner AND view together
    // This verifies the loading state properly guards the content
    const spinnerVisible = await itemsPage.loadingSpinner.isVisible();
    const gridVisible = await itemsPage.gridView.isVisible();

    // Either spinner is visible OR grid is visible, but not both
    if (spinnerVisible) {
      expect(gridVisible).toBe(false);
    }

    // Wait for loading to complete before test ends
    await itemsPage.waitForLoadingComplete();
  });

  test("grid view renders after loading completes on root page", async ({
    itemsPage,
  }) => {
    // Navigate and wait for loading
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Root page shows grid view or empty state
    await expect(
      itemsPage.gridView.or(itemsPage.emptyState).first()
    ).toBeVisible();
  });

  test("navigation to item detail shows loading then content", async ({
    itemsPage,
  }) => {
    // Create a test item
    await itemsPage.waitForLoadingComplete();
    await itemsPage.createItem("Loading Test Item");
    await itemsPage.waitForToastToDisappear();

    // Navigate to item detail
    await itemsPage.clickItem("Loading Test Item");

    // Verify content is ready
    await itemsPage.expectLoadingHidden();
    await expect(itemsPage.heroSection).toBeVisible();
  });

  test("switching view modes on item detail page", async ({
    page,
    itemsPage,
  }) => {
    // Create parent item and navigate to it (view toggle is on item detail pages)
    await itemsPage.createItem("View Switch Parent");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.clickItem("View Switch Parent");

    // Create children to display
    await itemsPage.createItem("View Switch Child A");
    await itemsPage.createItem("View Switch Child B");
    await itemsPage.waitForToastToDisappear();

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
