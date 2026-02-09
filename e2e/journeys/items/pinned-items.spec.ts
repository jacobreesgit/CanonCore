/**
 * E2E tests for pinned items feature.
 *
 * Two test suites:
 * 1. Pinned Sidebar Items (desktop only) - collapsible section under My Items
 * 2. Pinned Grid Items (all viewports) - pinned section in profile page grid
 */

import { test, expect } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

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
    await page.waitForLoadState("domcontentloaded");
  }
}

test.describe("Pinned Sidebar Items", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Skip on mobile - pinned items are a sidebar-only feature
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Pinned items are only available in desktop sidebar");
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
    await page.waitForLoadState("domcontentloaded");

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
    // Wait for network to settle after reload
    await page.waitForLoadState("domcontentloaded");

    // Item should still be pinned after refresh
    await expandSidebar(page);
    await itemsPage.expectItemPinnedInSidebar("Persistent Pin");
  });
});

test.describe("Pinned Grid Items (Profile Page)", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("pinned grid section is hidden when no items are pinned", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();
    await itemsPage.expectPinnedGridNotVisible();
  });

  test("pinned item appears in grid after pinning", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Grid Pin Test");

    // Pin the item
    await itemsPage.pinItemViaContextMenu("Grid Pin Test");

    // Item should appear in the pinned grid
    await itemsPage.expectPinnedGridVisible();
    await itemsPage.expectItemInPinnedGrid("Grid Pin Test");
  });

  test("pinned item removed from grid after unpinning", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Unpin Grid Test");

    // Pin then unpin the item
    await itemsPage.pinItemViaContextMenu("Unpin Grid Test");
    await itemsPage.expectPinnedGridVisible();

    await itemsPage.unpinItemViaContextMenu("Unpin Grid Test");

    // Pinned grid should be gone
    await itemsPage.expectPinnedGridNotVisible();
  });

  test("multiple pinned items display in grid", async ({ page, itemsPage }) => {
    // Creating 3 items + 3 pin operations needs more than 30s
    test.setTimeout(60000);
    await itemsPage.goto();
    await itemsPage.createItem("Pin A");
    await itemsPage.createItem("Pin B");
    await itemsPage.createItem("Pin C");

    // Pin all items (wait for network and UI to stabilize between pins)
    await itemsPage.pinItemViaContextMenu("Pin A");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    await itemsPage.pinItemViaContextMenu("Pin B");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    await itemsPage.pinItemViaContextMenu("Pin C");
    await page.waitForLoadState("domcontentloaded");

    // All should appear in pinned grid
    await itemsPage.expectPinnedGridVisible();
    await itemsPage.expectItemInPinnedGrid("Pin A");
    await itemsPage.expectItemInPinnedGrid("Pin B");
    await itemsPage.expectItemInPinnedGrid("Pin C");

    // Wait before counting
    await page.waitForTimeout(500);

    // Verify count
    const count = await itemsPage.getPinnedGridItemCount();
    expect(count).toBe(3);
  });

  test("clicking pinned grid item navigates to it", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Navigate Test");

    // Pin the item
    await itemsPage.pinItemViaContextMenu("Navigate Test");
    await itemsPage.expectItemInPinnedGrid("Navigate Test");

    // Click on the pinned item in the grid
    await itemsPage.clickItemInPinnedGrid("Navigate Test");

    // Should navigate to the item detail page
    await expect(page).toHaveURL(
      new RegExp(`/u/${testUser.username}/[a-z0-9-]+$`)
    );
    await itemsPage.expectHeroVisible("Navigate Test");
  });

  test("pinned grid items persist across page refresh", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Persist Grid");

    // Pin the item
    await itemsPage.pinItemViaContextMenu("Persist Grid");
    await itemsPage.expectItemInPinnedGrid("Persist Grid");

    // Refresh the page
    await itemsPage.page.reload();
    await itemsPage.waitForLoadingComplete();

    // Wait for pinned grid to be visible after reload (longer timeout for stability)
    await itemsPage.expectPinnedGridVisible();
    // Wait for network to settle after reload
    await itemsPage.page.waitForLoadState("domcontentloaded");
    await itemsPage.expectItemInPinnedGrid("Persist Grid");
  });

  test("pinned items appear before library items", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Library Item");
    await itemsPage.createItem("Pinned Item");

    // Pin one item
    await itemsPage.pinItemViaContextMenu("Pinned Item");

    // Verify sections exist: Pinned first, then Library
    await itemsPage.expectPinnedGridVisible();

    // Wait for UI to stabilize after pin operation
    await page.waitForLoadState("domcontentloaded");

    // Check that "Pinned" heading appears before "Library" heading
    // Use exact match to avoid matching item names like "Pinned Item"
    const pinnedHeading = page.getByRole("heading", {
      name: "Pinned",
      exact: true,
    });
    const libraryHeading = page.getByRole("heading", {
      name: "Library",
      exact: true,
    });

    await expect(pinnedHeading).toBeVisible({ timeout: 10000 });
    await expect(libraryHeading).toBeVisible({ timeout: 10000 });

    // Wait for layout to stabilize before measuring positions
    await page.waitForTimeout(500);

    // Verify order by bounding boxes
    const pinnedBox = await pinnedHeading.boundingBox();
    const libraryBox = await libraryHeading.boundingBox();
    expect(pinnedBox?.y).toBeLessThan(libraryBox?.y ?? 0);
  });

  test("max 10 pinned items enforced", async ({ page, itemsPage }) => {
    // Increase timeout for this test due to many operations
    test.setTimeout(120000);

    await itemsPage.goto();

    // Create 11 items
    for (let i = 1; i <= 11; i++) {
      await itemsPage.createItem(`Item ${i}`);
    }

    // Pin first 10 items (wait for each pin to complete)
    for (let i = 1; i <= 10; i++) {
      await itemsPage.pinItemViaContextMenu(`Item ${i}`);
      // Brief wait between pins to let UI update
      await page.waitForTimeout(300);
    }

    // Wait for pinned grid to show all items
    await itemsPage.expectPinnedGridVisible();
    await page.waitForLoadState("domcontentloaded");

    // Try to pin 11th item - should fail (max 10 enforced)
    // Don't use pinItemViaContextMenu here because it waits for the item to appear
    // in the pinned grid, which won't happen for a failed pin
    await itemsPage.openContextMenu(`Item 11`);
    await page.getByRole("menuitem", { name: /pin to sidebar/i }).click();
    await itemsPage.expectErrorToast("Maximum of 10 pinned items");

    // Wait for UI to stabilize
    await page.waitForTimeout(500);

    // Only 10 items should be in pinned grid
    const count = await itemsPage.getPinnedGridItemCount();
    expect(count).toBe(10);
  });
});
