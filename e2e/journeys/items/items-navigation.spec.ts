/**
 * E2E tests for items navigation.
 * Tests item navigation, breadcrumbs, and nested item creation.
 *
 * Note: Breadcrumb tests are desktop-only as breadcrumbs are hidden on mobile.
 */

import { test, expect } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Items Navigation Journey", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can navigate into an item by clicking", async ({ page, itemsPage }) => {
    const isMobile = await isMobileViewport(page);
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Should navigate to item detail page
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[a-z0-9]+/i);
    // Breadcrumb should show the item name (desktop only - hidden on mobile)
    if (!isMobile) {
      await itemsPage.expectBreadcrumb("Parent Folder");
    }
  });

  test("can navigate back via breadcrumbs", async ({ page, itemsPage }) => {
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Breadcrumbs are hidden on mobile");

    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");

    // Navigate back via home breadcrumb
    await itemsPage.breadcrumbHome.click();
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/);
    await itemsPage.expectItemVisible("Parent Folder");
  });

  test("can create nested items and navigate", async ({ page, itemsPage }) => {
    const isMobile = await isMobileViewport(page);

    // Create parent
    await itemsPage.createItem("Level 1");
    await itemsPage.clickItem("Level 1");

    // Create child
    await itemsPage.createItem("Level 2");
    await itemsPage.expectItemVisible("Level 2");

    // Navigate to child
    await itemsPage.clickItem("Level 2");
    // Breadcrumbs are hidden on mobile
    if (!isMobile) {
      await itemsPage.expectBreadcrumb("Level 1");
      await itemsPage.expectBreadcrumb("Level 2");
    }
  });
});
