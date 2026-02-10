/**
 * E2E tests for items CRUD operations.
 * Tests create, rename, and delete item functionality.
 *
 * Note: Empty state is covered by empty-states.spec.ts.
 * Note: Hero visibility is covered by cinematic-hero.spec.ts.
 */

import { test, expect } from "../../fixtures";

test.describe("Items CRUD Journey", () => {
  // Tests use itemsPage fixture which depends on testUser fixture
  // testUser fixture creates and logs in a user automatically

  test("can create a new item", async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("My First Folder");
    await itemsPage.expectItemVisible("My First Folder");
  });

  test("can rename an item via context menu", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    await itemsPage.createItem("Original Name");
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
    // Root profile page uses grid view - context menu works on grid items
    await itemsPage.deleteItemViaContextMenu("To Delete");
    await itemsPage.expectItemNotVisible("To Delete");
  });
});
