/**
 * E2E tests for edit mode toggle functionality.
 */

import { test, expect } from "../../fixtures";

test.describe("Edit Mode", () => {
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("Test Folder 1");
    await itemsPage.createItem("Test Folder 2");
  });

  test("should toggle between view and edit mode", async ({ itemsPage }) => {
    // Start in view mode
    await expect(
      itemsPage.page.getByRole("button", { name: "Enter edit mode" })
    ).toBeVisible();

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Should show Done button
    await expect(
      itemsPage.page.getByRole("button", { name: "Exit edit mode" })
    ).toBeVisible();

    // Exit edit mode
    await itemsPage.exitEditMode();

    // Should show Edit button again
    await expect(
      itemsPage.page.getByRole("button", { name: "Enter edit mode" })
    ).toBeVisible();
  });

  test("should exit edit mode when switching view modes", async ({
    itemsPage,
  }) => {
    // Navigate into folder where tree view exists
    await itemsPage.clickItem("Test Folder 1");

    // Create children so edit mode can be enabled
    await itemsPage.createItem("Child 1");
    await itemsPage.createItem("Child 2");

    // Ensure Custom Order sort (required for edit mode)
    await itemsPage.selectSortOption("Custom Order");

    // Enter edit mode
    await itemsPage.enterEditMode();
    expect(await itemsPage.isInEditMode()).toBe(true);

    // Switch to tree view (exists on item detail pages)
    await itemsPage.switchToTreeView();

    // Should exit edit mode - wait for the button to appear
    await expect(
      itemsPage.page.getByRole("button", { name: "Enter edit mode" })
    ).toBeVisible();
    expect(await itemsPage.isInEditMode()).toBe(false);
  });

  test("should disable edit toggle when no items", async ({
    itemsPage,
    page,
  }) => {
    // Delete all items via grid context menu (root page is grid view)
    await itemsPage.deleteItemViaContextMenu("Test Folder 1");
    await itemsPage.deleteItemViaContextMenu("Test Folder 2");

    // Edit button should be disabled when no items
    await expect(
      page.getByRole("button", { name: "Enter edit mode" })
    ).toBeDisabled();
  });
});
