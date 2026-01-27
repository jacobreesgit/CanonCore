/**
 * E2E tests for pinned sidebar items feature.
 * Tests pin/unpin operations via context menu and sidebar navigation.
 */

import { test, expect } from "../../fixtures";

// Helper to expand sidebar (collapsed by default on both mobile and desktop)
async function expandSidebar(page: import("@playwright/test").Page) {
  // Check if sidebar content is already visible (look for "My Items" text in sidebar)
  const sidebarContent = page.locator('[data-slot="sidebar-menu-button"]', {
    hasText: "My Items",
  });
  const isExpanded = await sidebarContent.isVisible().catch(() => false);
  if (isExpanded) return;

  // Click toggle to expand sidebar
  const toggleButton = page.getByRole("button", { name: "Toggle Sidebar" });
  if (await toggleButton.isVisible()) {
    await toggleButton.click();
    // Wait for sidebar to animate open
    await page.waitForTimeout(300);
  }
}

// Helper to close sidebar on mobile (if open, to access content behind it)
async function closeSidebarIfMobile(page: import("@playwright/test").Page) {
  // On mobile, the sidebar is a Sheet/Drawer dialog
  const sidebarDialog = page.getByRole("dialog", { name: "Sidebar" });
  const isDialogVisible = await sidebarDialog.isVisible().catch(() => false);

  if (isDialogVisible) {
    // Click on the overlay (right side of viewport) to close the drawer
    // The sidebar is on the left (w-3/4 = 75%), so clicking at 90% x should hit the overlay
    const viewport = page.viewportSize();
    if (viewport) {
      await page.mouse.click(viewport.width * 0.9, viewport.height / 2);
    }
    // Wait for dialog to close
    await expect(sidebarDialog).not.toBeVisible({ timeout: 5000 });
    // Wait for content to be interactable
    await page.waitForTimeout(300);
    await page.waitForLoadState("networkidle");
  }
}

test.describe("Pinned Sidebar Items", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("Pinned Items section is hidden when no items are pinned", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();
    await expandSidebar(page);
    await itemsPage.expectPinnedSectionNotVisible();
  });

  test("can pin an item via context menu", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Movies");

    // Context menu works in grid view (tree view disabled at profile level)
    await itemsPage.pinItemViaContextMenu("Movies");

    // Check item appears in sidebar
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("Movies");
  });

  test("can unpin an item via context menu", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("TV Shows");

    // Pin first (context menu works in grid view)
    await itemsPage.pinItemViaContextMenu("TV Shows");

    // Verify it's pinned
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("TV Shows");

    // Close sidebar before accessing grid view
    await closeSidebarIfMobile(page);

    // Wait for item to be ready
    await itemsPage.expectItemVisible("TV Shows");

    // Unpin
    await itemsPage.unpinItemViaContextMenu("TV Shows");

    // Check item no longer in sidebar
    await expandSidebar(page);
    await itemsPage.expectPinnedSectionNotVisible();
  });

  test("pinned section disappears when last item is unpinned", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Music");

    // Pin the item (context menu works in grid view)
    await itemsPage.pinItemViaContextMenu("Music");

    // Verify pinned section is visible
    await expandSidebar(page);
    await itemsPage.expectPinnedSectionVisible();

    // Close sidebar before accessing grid view
    await closeSidebarIfMobile(page);

    // Wait for item to be ready
    await itemsPage.expectItemVisible("Music");

    // Unpin the item
    await itemsPage.unpinItemViaContextMenu("Music");

    // Pinned section should be gone
    await expandSidebar(page);
    await itemsPage.expectPinnedSectionNotVisible();
  });

  test("can pin multiple items", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Movies");
    await itemsPage.createItem("TV Shows");

    // Pin both items (context menu works in grid view)
    await itemsPage.pinItemViaContextMenu("Movies");
    await itemsPage.pinItemViaContextMenu("TV Shows");

    // Check both appear in sidebar
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("Movies");
    await itemsPage.expectItemPinnedInSidebar("TV Shows");
  });

  test("clicking pinned item navigates to it", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Favorites");

    // Pin the item (context menu works in grid view)
    await itemsPage.pinItemViaContextMenu("Favorites");

    // Click the pinned item in sidebar
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("Favorites");
    await itemsPage.clickPinnedItem("Favorites");

    // Wait for navigation to complete
    await page.waitForLoadState("networkidle");

    // Close sidebar on mobile so we can see the hero
    await closeSidebarIfMobile(page);

    // Should navigate to the item detail page
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+\/[a-z0-9-]+$/);
    // Hero should show item name
    await itemsPage.expectHeroVisible("Favorites");
  });

  test("pinned items persist across page refresh", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Persistent Pin");

    // Pin the item (context menu works in grid view)
    await itemsPage.pinItemViaContextMenu("Persistent Pin");

    // Verify it's pinned (confirms operation completed)
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("Persistent Pin");

    // Refresh the page
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    // Item should still be pinned after refresh
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("Persistent Pin");
  });
});
