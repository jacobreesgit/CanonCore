/**
 * E2E tests for hierarchical tree display.
 * Tests that full hierarchy is displayed with collapse/expand functionality.
 * Note: Tree view is only on item detail pages (when viewing children).
 */

import { test, expect } from "../../fixtures";

test.describe("Items Hierarchy Journey", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("displays full hierarchy in tree view", async ({ itemsPage }) => {
    // Create hierarchy: Top Level > Parent > Child > Grandchild
    await itemsPage.createItem("Top Level");

    await itemsPage.clickItem("Top Level");
    await itemsPage.createItem("Parent");

    await itemsPage.clickItem("Parent");
    await itemsPage.createItem("Child");

    await itemsPage.clickItem("Child");
    await itemsPage.createItem("Grandchild");

    // Navigate back to Top Level (tree view is on item detail pages)
    await itemsPage.clickBreadcrumb("Top Level");
    await itemsPage.switchToTreeView();

    // All descendants should be visible in tree view
    await itemsPage.expectItemVisible("Parent");
    await itemsPage.expectItemVisible("Child");
    await itemsPage.expectItemVisible("Grandchild");
  });

  test("can collapse and expand items in tree", async ({ itemsPage }) => {
    // Create Top Level container to view tree in
    await itemsPage.createItem("Top Level");

    await itemsPage.clickItem("Top Level");
    // Create hierarchy: Parent > Child
    await itemsPage.createItem("Collapsible Parent");

    await itemsPage.clickItem("Collapsible Parent");
    await itemsPage.createItem("Nested Child");

    // Navigate back to Top Level to view tree
    await itemsPage.clickBreadcrumb("Top Level");
    await itemsPage.switchToTreeView();

    // Both items should be visible in tree
    await itemsPage.expectItemVisible("Collapsible Parent");
    await itemsPage.expectItemVisible("Nested Child");

    // Collapse parent
    await itemsPage.collapseItem("Collapsible Parent");

    // Child should now be hidden
    await itemsPage.expectItemNotVisible("Nested Child");

    // Expand parent
    await itemsPage.expandItem("Collapsible Parent");

    // Child should be visible again
    await itemsPage.expectItemVisible("Nested Child");
  });
});
