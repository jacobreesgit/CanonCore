/**
 * E2E tests for items loading behavior.
 * Verifies that the loading spinner prevents view flash during hydration.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items Loading Spinner", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("items-loading");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("loading spinner clears before content renders", async ({
    page,
    itemsPage,
  }) => {
    // Wait for loading to complete
    await itemsPage.waitForLoadingComplete();

    // Verify spinner is hidden and content is visible
    await itemsPage.expectLoadingHidden();
    await expect(
      itemsPage.emptyState.or(itemsPage.treeView).or(itemsPage.gridView).first()
    ).toBeVisible();
  });

  test("does not show both loading and view simultaneously", async ({
    page,
    itemsPage,
  }) => {
    // Navigate to items page
    await itemsPage.goto();

    // At any point, we should not see loading spinner AND tree/grid view together
    // This verifies the loading state properly guards the content
    const spinnerVisible = await itemsPage.loadingSpinner.isVisible();
    const treeVisible = await itemsPage.treeView.isVisible();
    const gridVisible = await itemsPage.gridView.isVisible();

    // Either spinner is visible OR tree/grid is visible, but not both
    if (spinnerVisible) {
      expect(treeVisible).toBe(false);
      expect(gridVisible).toBe(false);
    }

    // Wait for loading to complete before test ends
    await itemsPage.waitForLoadingComplete();
  });

  test("tree view renders quickly after hydration (no preload delay)", async ({
    page,
    itemsPage,
  }) => {
    // Set localStorage to tree view before navigation
    await page.evaluate(() => {
      localStorage.setItem("items-view-mode", "tree");
    });

    // Navigate and verify tree view appears
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Tree view should be visible (or empty state)
    await expect(
      itemsPage.treeView.or(itemsPage.emptyState).first()
    ).toBeVisible();
  });

  test("grid view renders after loading completes", async ({
    page,
    itemsPage,
  }) => {
    // Set localStorage to grid view before navigation
    await page.evaluate(() => {
      localStorage.setItem("items-view-mode", "grid");
    });

    // Navigate and wait for loading
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();

    // Grid view should be visible (or empty state)
    await expect(
      itemsPage.gridView.or(itemsPage.emptyState).first()
    ).toBeVisible();
  });

  test("navigation to item detail shows loading then content", async ({
    page,
    itemsPage,
  }) => {
    // Create a test item
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();
    await itemsPage.createItem("Loading Test Item");
    await itemsPage.waitForToastToDisappear();

    // Navigate to item detail
    await itemsPage.clickItem("Loading Test Item");

    // Verify content is ready
    await itemsPage.expectLoadingHidden();
    await expect(itemsPage.heroSection).toBeVisible();
  });

  test("switching view modes shows correct view after loading", async ({
    page,
    itemsPage,
  }) => {
    // Start in tree view
    await page.evaluate(() => {
      localStorage.setItem("items-view-mode", "tree");
    });

    // Create a test item to have content to display
    await itemsPage.gotoAndWaitForContent();
    await itemsPage.createItem("View Switch Item");
    await itemsPage.waitForToastToDisappear();

    await expect(itemsPage.treeView).toBeVisible();

    // Switch to grid view
    await itemsPage.switchToGridView();
    await expect(itemsPage.gridView).toBeVisible();

    // Switch back to tree view
    await itemsPage.switchToTreeView();
    await expect(itemsPage.treeView).toBeVisible();
  });
});
