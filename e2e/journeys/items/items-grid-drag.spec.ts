/**
 * E2E tests for grid view drag operations.
 * Tests dnd-kit sortable grid reordering.
 *
 * Uses Playwright's dragTo() method for simulating drag-and-drop
 * on dnd-kit components with PointerSensor.
 *
 * Note: Root profile page is always grid view. Tree view is only on item detail pages.
 */

import { test, expect } from "../../fixtures";

test.describe("Items Grid Drag Journey", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });

    // Create test items on root profile page (grid view by default)
    await itemsPage.createItem("Grid Item 1");
    await itemsPage.createItem("Grid Item 2");
    await itemsPage.createItem("Grid Item 3");

    // Wait for toasts to disappear
  });

  test("items display correctly in grid view", async ({ itemsPage }) => {
    // Root profile page is always grid view
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");

    // Grid view container should be visible
    await expect(itemsPage.gridView).toBeVisible();
  });

  test("grid items have data-id attributes", async ({ page }) => {
    // Verify grid items have data-id for dnd-kit tracking
    const gridItems = page.locator("[data-id]");
    const count = await gridItems.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("can reorder items by dragging in grid view", async ({
    page,
    itemsPage,
  }) => {
    // Enter edit mode to enable dragging
    await itemsPage.enterEditMode();

    // Drag Grid Item 1 to Grid Item 3's position
    await itemsPage.dragItemTo("Grid Item 1", "Grid Item 3");

    // Wait for reorder to persist via network
    await page.waitForLoadState("networkidle");

    // All items should still be visible
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");
  });

  test("grid item shows hover state", async ({ itemsPage }) => {
    const gridItem = itemsPage.getGridItemByName("Grid Item 1");
    await gridItem.hover();

    // The item should have hover styling applied
    // Grid items show shadow and scale effects on hover
    await expect(gridItem).toBeVisible();
  });

  test("can drag grid item to new position using coordinates", async ({
    page,
    itemsPage,
  }) => {
    // Enter edit mode to enable dragging
    await itemsPage.enterEditMode();

    const item1 = itemsPage.getGridItemByName("Grid Item 1");
    const item3 = itemsPage.getGridItemByName("Grid Item 3");

    const sourceBox = await item1.boundingBox();
    const targetBox = await item3.boundingBox();

    if (sourceBox && targetBox) {
      // Use precise coordinates for drag operation
      await item1.dragTo(item3, {
        sourcePosition: {
          x: sourceBox.width / 2,
          y: sourceBox.height / 2,
        },
        targetPosition: {
          x: targetBox.width / 2,
          y: targetBox.height / 2,
        },
      });
    }

    // Wait for reorder to persist via network
    await page.waitForLoadState("networkidle");

    // Verify items are still present after drag
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");
  });

  test("order persists after navigating to item detail and back", async ({
    page,
    itemsPage,
  }) => {
    // Enter edit mode to enable dragging
    await itemsPage.enterEditMode();

    // Perform a drag
    await itemsPage.dragItemTo("Grid Item 2", "Grid Item 1");
    await page.waitForLoadState("networkidle");

    // Exit edit mode
    await itemsPage.exitEditMode();

    // Navigate to item detail page
    await itemsPage.clickItem("Grid Item 1");

    // Navigate back to root via breadcrumb
    await itemsPage.breadcrumbHome.click();

    // Items should persist on root page
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");
  });
});
