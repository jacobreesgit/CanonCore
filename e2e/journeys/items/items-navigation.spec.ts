/**
 * E2E tests for items navigation.
 * Tests item navigation, breadcrumbs, and nested item creation.
 */

import { test, expect } from "../../fixtures";

test.describe("Items Navigation Journey", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can navigate into an item by clicking", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Should navigate to item detail page
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[a-z0-9]+/i);
    // Breadcrumb should show the item name
    await itemsPage.expectBreadcrumb("Parent Folder");
  });

  test("can navigate back via breadcrumbs", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Navigate back via home breadcrumb
    await itemsPage.breadcrumbHome.click();
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/);
    await itemsPage.expectItemVisible("Parent Folder");
  });

  test("can create nested items and navigate", async ({ page, itemsPage }) => {
    // Create parent
    await itemsPage.createItem("Level 1");
    await itemsPage.clickItem("Level 1");

    // Create child
    await itemsPage.createItem("Level 2");
    await itemsPage.expectItemVisible("Level 2");

    // Navigate to child
    await itemsPage.clickItem("Level 2");
    await itemsPage.expectBreadcrumb("Level 1");
    await itemsPage.expectBreadcrumb("Level 2");
  });
});
