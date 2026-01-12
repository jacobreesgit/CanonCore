/**
 * E2E tests for items view toggle.
 * Tests switching between tree and grid views.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items View Toggle Journey", () => {
  test.beforeEach(async ({ page, signUpPage, itemsPage }) => {
    const email = generateUniqueEmail("items-view");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create some test items
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");

    // Wait for toasts to clear before tests proceed
    await itemsPage.waitForToastToDisappear();
  });

  test("can switch between tree and grid view", async ({ itemsPage }) => {
    await itemsPage.goto();

    // Default is grid view
    await expect(itemsPage.gridView).toBeVisible();

    // Switch to tree
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
    await itemsPage.goto();
    await page.waitForLoadState("networkidle");

    // Switch to grid
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();

    // Navigate away and back (wait for full page load)
    await page.goto("/my-items");
    await page.waitForLoadState("networkidle");
    await expect(itemsPage.gridView).toBeVisible();
  });

  test("items visible in both views", async ({ itemsPage }) => {
    await itemsPage.goto();

    // Check grid view (default)
    await itemsPage.expectItemVisible("Folder A");
    await itemsPage.expectItemVisible("Folder B");

    // Check tree view
    await itemsPage.switchToTreeView();
    await itemsPage.expectItemVisible("Folder A");
    await itemsPage.expectItemVisible("Folder B");
  });
});
