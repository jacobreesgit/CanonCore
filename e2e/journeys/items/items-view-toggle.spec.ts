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
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Create some test items
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");

    // Wait for toasts to clear before tests proceed
    await itemsPage.waitForToastToDisappear();
  });

  test("can switch between tree and grid view", async ({ itemsPage }) => {
    await itemsPage.goto();

    // Default is tree view
    await expect(itemsPage.treeView).toBeVisible();

    // Switch to grid
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();

    // Switch back to tree
    await itemsPage.switchToTreeView();
    await expect(itemsPage.treeView).toBeVisible();
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
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(itemsPage.gridView).toBeVisible();
  });

  test("items visible in both views", async ({ itemsPage }) => {
    await itemsPage.goto();

    // Check tree view
    await itemsPage.expectItemVisible("Folder A");
    await itemsPage.expectItemVisible("Folder B");

    // Check grid view
    await itemsPage.switchToGridView();
    await itemsPage.expectItemVisible("Folder A");
    await itemsPage.expectItemVisible("Folder B");
  });
});
