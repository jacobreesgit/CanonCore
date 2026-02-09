/**
 * Heavy E2E tests that require sequential execution.
 *
 * These tests involve multiple createItem + clickItem cycles and are
 * sensitive to server contention under parallel workers. Running them
 * serially in a single worker prevents timeout failures.
 */

import { test, expect } from "../../fixtures";

test.describe("Heavy Items (serial)", () => {
  test.describe.configure({ mode: "serial" });

  test("should exit edit mode when switching view modes", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("Test Folder 1");
    await itemsPage.createItem("Test Folder 2");

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

  test("hides progress bar in edit mode (tree view)", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create parent and navigate to it (tree view is on item detail pages)
    await itemsPage.createItem("Tree Parent");
    await itemsPage.clickItem("Tree Parent");

    // Create child items
    await itemsPage.createItem("Tree Child A");
    await itemsPage.createItem("Tree Child B");

    // Switch to tree view
    await itemsPage.switchToTreeView();

    // Set sort to Custom Order (required for edit mode)
    await itemsPage.selectSortOption("Custom Order");

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Progress bar should not be visible in edit mode
    await expect(page.getByTestId("tree-item-progress-bar")).not.toBeVisible();

    // Exit edit mode
    await itemsPage.exitEditMode();
  });

  test("navigates between views without progress bar errors", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create parent and navigate to it (view toggle is on item detail pages)
    await itemsPage.createItem("View Toggle Parent");
    await itemsPage.clickItem("View Toggle Parent");

    // Create child items
    await itemsPage.createItem("Progress Item A");
    await itemsPage.createItem("Progress Item B");

    // Switch between views multiple times
    await itemsPage.switchToTreeView();
    await expect(
      page.getByTestId("items-tree-view").getByText("Progress Item A")
    ).toBeVisible();

    await itemsPage.switchToGridView();
    await expect(
      page.getByTestId("items-grid-view").getByText("Progress Item A").first()
    ).toBeVisible();

    // No errors should occur - page should remain stable
    await expect(page.getByTestId("items-grid-view")).toBeVisible();
  });

  test("view preference persists across navigation", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create parent container and navigate into it (tree view only on item detail pages)
    await itemsPage.createItem("Persist Container");
    await itemsPage.clickItem("Persist Container");

    // Create some test items inside the container
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await page.waitForLoadState("domcontentloaded");

    // Switch to grid
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();

    // Navigate away and back (wait for full page load)
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    await expect(itemsPage.gridView).toBeVisible();
  });
});
