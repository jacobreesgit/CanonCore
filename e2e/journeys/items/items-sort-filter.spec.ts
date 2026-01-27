/**
 * E2E tests for items sort and filter functionality.
 * Tests sort dropdown, filter dropdown, edit mode disabling, and persistence.
 */

import { test, expect } from "../../fixtures";

test.describe("Items Sort/Filter Journey", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create test items with different names for sorting tests
    await itemsPage.createItem("Alpha Item");
    await itemsPage.createItem("Beta Item");
    await itemsPage.createItem("Charlie Item");

    // Wait for toasts to clear
  });

  test("sort dropdown changes item order", async ({ itemsPage }) => {
    // Default is Custom Order, items should be in creation order
    await itemsPage.expectItemOrder([
      "Alpha Item",
      "Beta Item",
      "Charlie Item",
    ]);

    // Sort by Name A-Z
    await itemsPage.selectSortOption("Name A-Z");
    await itemsPage.expectItemOrder([
      "Alpha Item",
      "Beta Item",
      "Charlie Item",
    ]);

    // Sort by Name Z-A
    await itemsPage.selectSortOption("Name Z-A");
    await itemsPage.expectItemOrder([
      "Charlie Item",
      "Beta Item",
      "Alpha Item",
    ]);
  });

  test("edit mode disabled when not using custom sort", async ({
    itemsPage,
  }) => {
    // With custom sort, edit mode should be enabled
    const customSortEditDisabled = await itemsPage.isEditModeDisabled();
    expect(customSortEditDisabled).toBe(false);

    // Change to Name A-Z sort
    await itemsPage.selectSortOption("Name A-Z");

    // Edit mode should now be disabled
    const nameSortEditDisabled = await itemsPage.isEditModeDisabled();
    expect(nameSortEditDisabled).toBe(true);

    // Switch back to Custom Order
    await itemsPage.selectSortOption("Custom Order");

    // Edit mode should be enabled again
    const backToCustomEditDisabled = await itemsPage.isEditModeDisabled();
    expect(backToCustomEditDisabled).toBe(false);
  });

  test("sort preference persists across page reload", async ({
    page,
    itemsPage,
  }) => {
    // Change sort to Name Z-A
    await itemsPage.selectSortOption("Name Z-A");

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Sort should still be Name Z-A
    const currentSort = await itemsPage.getCurrentSortOption();
    expect(currentSort).toContain("Name Z-A");

    // Items should still be in Z-A order
    await itemsPage.expectItemOrder([
      "Charlie Item",
      "Beta Item",
      "Alpha Item",
    ]);
  });

  test("filter dropdown filters visible items", async ({ itemsPage }) => {
    // All items visible by default
    await itemsPage.expectItemVisible("Alpha Item");
    await itemsPage.expectItemVisible("Beta Item");
    await itemsPage.expectItemVisible("Charlie Item");

    // Filter to "No Files" - all test items have no files, so all should be visible
    await itemsPage.selectFilterOption("No Files");

    // All items should still be visible (they have no files)
    await itemsPage.expectItemVisible("Alpha Item");
    await itemsPage.expectItemVisible("Beta Item");
    await itemsPage.expectItemVisible("Charlie Item");

    // Filter to "Has Files" - no items have files, so none should be visible
    await itemsPage.selectFilterOption("Has Files");

    // Items should not be visible (or empty state shown)
    await itemsPage.expectItemNotVisible("Alpha Item");
    await itemsPage.expectItemNotVisible("Beta Item");
    await itemsPage.expectItemNotVisible("Charlie Item");

    // Reset filter to All Items
    await itemsPage.selectFilterOption("All Items");

    // All items visible again
    await itemsPage.expectItemVisible("Alpha Item");
    await itemsPage.expectItemVisible("Beta Item");
    await itemsPage.expectItemVisible("Charlie Item");
  });

  test("filter preference persists across page reload", async ({
    page,
    itemsPage,
  }) => {
    // Change filter to No Files
    await itemsPage.selectFilterOption("No Files");

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Filter should still be No Files
    const currentFilter = await itemsPage.getCurrentFilterOption();
    expect(currentFilter).toContain("No Files");
  });

  test("sort and filter work together", async ({ itemsPage }) => {
    // Sort by Name Z-A
    await itemsPage.selectSortOption("Name Z-A");

    // Filter to No Files
    await itemsPage.selectFilterOption("No Files");

    // Items should be sorted Z-A and filtered (all visible since none have files)
    await itemsPage.expectItemOrder([
      "Charlie Item",
      "Beta Item",
      "Alpha Item",
    ]);
  });
});
