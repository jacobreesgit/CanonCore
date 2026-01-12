/**
 * E2E tests for edit mode toggle functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Edit Mode", () => {
  test.beforeEach(async ({ page, signUpPage, itemsPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("edit-mode");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    await itemsPage.goto();
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
    // Enter edit mode
    await itemsPage.enterEditMode();
    expect(await itemsPage.isInEditMode()).toBe(true);

    // Switch to tree view (different from current grid view - grid is default)
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
    // Switch to tree view for more stable context menu
    await itemsPage.switchToTreeView();

    // Delete all items
    await itemsPage.deleteItemViaContextMenu("Test Folder 1");
    await itemsPage.deleteItemViaContextMenu("Test Folder 2");

    // Edit button should be disabled when no items
    await expect(
      page.getByRole("button", { name: "Enter edit mode" })
    ).toBeDisabled();
  });
});
