/**
 * E2E tests for items CRUD operations.
 * Tests create, rename, and delete folder functionality.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items CRUD Journey", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("items-crud");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("shows empty state when no items exist", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.expectEmptyState();
  });

  test("can create a new folder", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("My First Folder");
    await itemsPage.expectItemVisible("My First Folder");
    await itemsPage.expectSuccessToast('Created "My First Folder"');
  });

  test("can rename a folder via context menu", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Original Name");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.renameItemViaContextMenu("Original Name", "Renamed Folder");
    await itemsPage.expectItemVisible("Renamed Folder");
    await itemsPage.expectItemNotVisible("Original Name");
    await itemsPage.expectSuccessToast('Renamed to "Renamed Folder"');
  });

  test("can delete a folder via context menu", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("To Delete");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.deleteItemViaContextMenu("To Delete");
    await itemsPage.expectItemNotVisible("To Delete");
    await itemsPage.expectSuccessToast("Folder deleted");
  });
});
