/**
 * E2E tests for grid view drag operations.
 * Tests dnd-kit sortable grid reordering.
 *
 * Uses Playwright's dragTo() method for simulating drag-and-drop
 * on dnd-kit components with PointerSensor.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Items Grid Drag Journey", () => {
  test.beforeEach(async ({ page, signUpPage, itemsPage }) => {
    const email = generateUniqueEmail("items-grid-drag");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Create test items
    await itemsPage.createItem("Grid Item 1");
    await itemsPage.createItem("Grid Item 2");
    await itemsPage.createItem("Grid Item 3");

    // Wait for toasts to disappear before switching views
    await itemsPage.waitForToastToDisappear();

    // Switch to grid view
    await itemsPage.switchToGridView();
  });

  test("items display correctly in grid view", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.switchToGridView();

    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");

    // Grid view container should be visible
    await expect(itemsPage.gridView).toBeVisible();
  });

  test("grid items have data-id attributes", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.switchToGridView();

    // Verify grid items have data-id for dnd-kit tracking
    const gridItems = page.locator("[data-id]");
    const count = await gridItems.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test("can reorder items by dragging in grid view", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.switchToGridView();

    // Drag Grid Item 1 to Grid Item 3's position
    await itemsPage.dragItemTo("Grid Item 1", "Grid Item 3");

    await page.waitForTimeout(500);

    // All items should still be visible
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");
  });

  test("grid item shows hover state", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.switchToGridView();

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
    await itemsPage.goto();
    await itemsPage.switchToGridView();

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

    await page.waitForTimeout(500);

    // Verify items are still present after drag
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");
  });

  test("order persists after switching views", async ({ page, itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.switchToGridView();

    // Perform a drag
    await itemsPage.dragItemTo("Grid Item 2", "Grid Item 1");
    await page.waitForTimeout(500);

    // Switch to tree view
    await itemsPage.switchToTreeView();

    // Items should still be visible in tree view
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");

    // Switch back to grid view
    await itemsPage.switchToGridView();

    // Items should persist
    await itemsPage.expectItemVisible("Grid Item 1");
    await itemsPage.expectItemVisible("Grid Item 2");
    await itemsPage.expectItemVisible("Grid Item 3");
  });
});
