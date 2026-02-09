/**
 * E2E tests for bulk delete functionality.
 * Tests selection, bulk actions toolbar, and multi-item deletion.
 */

import { test, expect } from "../../fixtures";

test.describe("Bulk Delete", () => {
  // Uses testUser fixture (via itemsPage dependency) for automatic login

  test("should show bulk actions toolbar in edit mode", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create test items
    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    // Enter edit mode
    await itemsPage.enterEditMode();

    // Should show bulk actions toolbar (select-all button is hidden on mobile)
    await itemsPage.expectSelectionCount(0);

    // Delete button should be disabled when nothing selected
    await itemsPage.expectNoBulkDeleteButton();
  });

  test("should select individual items with checkbox", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    await itemsPage.enterEditMode();

    // Select first item
    await itemsPage.selectItem("Folder A");
    await itemsPage.expectSelectionCount(1);
    await itemsPage.expectBulkDeleteButton(1);

    // Select second item
    await itemsPage.selectItem("Folder B");
    await itemsPage.expectSelectionCount(2);
    await itemsPage.expectBulkDeleteButton(2);
  });

  test("should select all items with select-all checkbox", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    await itemsPage.enterEditMode();

    // Click select all
    await itemsPage.toggleSelectAll();
    await itemsPage.expectSelectionCount(3);
    await itemsPage.expectBulkDeleteButton(3);

    // Click again to deselect all
    await itemsPage.toggleSelectAll();
    await itemsPage.expectSelectionCount(0);
    await itemsPage.expectNoBulkDeleteButton();
  });

  test("should delete selected items", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    await itemsPage.enterEditMode();

    // Select two items
    await itemsPage.selectItem("Folder A");
    await itemsPage.selectItem("Folder B");
    await itemsPage.expectSelectionCount(2);

    // Click bulk delete
    await itemsPage.clickBulkDelete();

    // Items should be removed
    await itemsPage.expectItemNotVisible("Folder A");
    await itemsPage.expectItemNotVisible("Folder B");
    await itemsPage.expectItemVisible("Folder C");
  });

  test("should delete all items with select-all", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    await itemsPage.enterEditMode();

    // Select all
    await itemsPage.toggleSelectAll();
    await itemsPage.expectSelectionCount(3);

    // Click bulk delete
    await itemsPage.clickBulkDelete();

    // All items should be removed, edit mode should exit
    await itemsPage.expectItemNotVisible("Folder A");
    await itemsPage.expectItemNotVisible("Folder B");
    await itemsPage.expectItemNotVisible("Folder C");
  });

  test("should clear selection when exiting edit mode", async ({
    page,
    testUser,
    itemsPage,
  }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    await itemsPage.enterEditMode();

    // Select items
    await itemsPage.selectItem("Folder A");
    await itemsPage.selectItem("Folder B");
    await itemsPage.expectSelectionCount(2);

    // Exit edit mode
    await itemsPage.exitEditMode();

    // Re-enter edit mode
    await itemsPage.enterEditMode();

    // Selection should be cleared
    await itemsPage.expectSelectionCount(0);
    await itemsPage.expectNoBulkDeleteButton();
  });

  test("should work in grid view", async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    await itemsPage.createItem("Folder A");
    await itemsPage.createItem("Folder B");
    await itemsPage.createItem("Folder C");

    // Root profile page is already in grid view
    await itemsPage.enterEditMode();

    // Select items in grid view
    await itemsPage.selectItem("Folder A");
    await itemsPage.selectItem("Folder C");
    await itemsPage.expectSelectionCount(2);

    // Delete
    await itemsPage.clickBulkDelete();

    // Verify deletions
    await itemsPage.expectItemNotVisible("Folder A");
    await itemsPage.expectItemNotVisible("Folder C");
    await itemsPage.expectItemVisible("Folder B");
  });
});
