/**
 * E2E tests for item progress bars.
 * Tests progress bar visibility and behavior in grid, tree, and hero views.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Item Progress Bars", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("item-progress");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("hides progress bar when item has no media files", async ({
    page,
    itemsPage,
  }) => {
    // Create empty folder
    await itemsPage.createItem("Empty Folder");

    // Should not show progress bar in grid view (default)
    await expect(page.getByTestId("grid-item-progress-bar")).not.toBeVisible();

    // Switch to tree view and verify no progress bar there either
    await itemsPage.switchToTreeView();
    await expect(page.getByTestId("tree-item-progress-bar")).not.toBeVisible();

    // Cleanup
    await itemsPage.deleteItemViaContextMenu("Empty Folder");
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

    // Cleanup
    await itemsPage.deleteItemViaContextMenu("Grid Test Item");
  });

  test("hides progress bar in edit mode (tree view)", async ({
    page,
    itemsPage,
  }) => {
    // Create item and switch to tree view
    await itemsPage.createItem("Tree Test Item");
    await itemsPage.switchToTreeView();

    // Set sort to Custom Order (required for edit mode)
    await itemsPage.selectSortOption("Custom Order");

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Progress bar should not be visible in edit mode
    await expect(page.getByTestId("tree-item-progress-bar")).not.toBeVisible();

    // Exit edit mode
    await itemsPage.exitEditMode();

    // Cleanup
    await itemsPage.deleteItemViaContextMenu("Tree Test Item");
  });

  test("shows hero section on item detail page", async ({
    page,
    itemsPage,
  }) => {
    // Create item
    await itemsPage.createItem("Hero Test");

    // Navigate to item detail
    await itemsPage.clickItem("Hero Test");

    // Verify hero is visible
    const hero = page.getByTestId("item-hero");
    await expect(hero).toBeVisible();

    // Hero progress bar should not be visible (no media files)
    await expect(page.getByTestId("hero-progress-bar")).not.toBeVisible();

    // Navigate back and cleanup
    await itemsPage.breadcrumbHome.click();
    await itemsPage.deleteItemViaContextMenu("Hero Test");
  });

  test("navigates between views without progress bar errors", async ({
    page,
    itemsPage,
  }) => {
    // Create a few items
    await itemsPage.createItem("Progress Item A");
    await itemsPage.createItem("Progress Item B");

    // Wait for toast to disappear before switching views
    await page.waitForTimeout(1000);

    // Switch between views multiple times
    await itemsPage.switchToTreeView();
    await expect(
      page.getByTestId("items-tree-view").getByText("Progress Item A")
    ).toBeVisible();

    await itemsPage.switchToGridView();
    await expect(
      page.getByTestId("items-grid-view").getByText("Progress Item A")
    ).toBeVisible();

    // No errors should occur - page should remain stable
    await expect(page.getByTestId("items-grid-view")).toBeVisible();

    // Cleanup
    await itemsPage.deleteItemViaContextMenu("Progress Item A");
    await itemsPage.deleteItemViaContextMenu("Progress Item B");
  });
});
