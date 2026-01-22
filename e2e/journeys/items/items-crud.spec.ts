/**
 * E2E tests for items CRUD operations.
 * Tests create, rename, and delete item functionality.
 */

import { test, expect } from "../../fixtures";

test.describe("Items CRUD Journey", () => {
  // Tests use itemsPage fixture which depends on testUser fixture
  // testUser fixture creates and logs in a user automatically

  test("shows empty state when no items exist", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    // Verify we're logged in as the test user
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.goto();
    await itemsPage.expectEmptyState();
  });

  test("shows hero on root My Items page", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.expectHeroVisible(`@${testUser.username}`);
  });

  test("can create a new item", async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("My First Folder");
    await itemsPage.expectItemVisible("My First Folder");
    await itemsPage.expectSuccessToast('Created "My First Folder"');
  });

  test("can rename an item via context menu", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("Original Name");
    await itemsPage.waitForToastToDisappear();
    // Root profile page uses grid view - context menu works on grid items
    await itemsPage.renameItemViaContextMenu("Original Name", "Renamed Folder");
    // Toast is verified in renameItemViaContextMenu, just verify UI state
    await itemsPage.expectItemVisible("Renamed Folder");
    await itemsPage.expectItemNotVisible("Original Name");
  });

  test("can delete an item via context menu", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("To Delete");
    await itemsPage.waitForToastToDisappear();
    // Root profile page uses grid view - context menu works on grid items
    await itemsPage.deleteItemViaContextMenu("To Delete");
    await itemsPage.expectItemNotVisible("To Delete");
    await itemsPage.expectSuccessToast("Deleted successfully");
  });
});
