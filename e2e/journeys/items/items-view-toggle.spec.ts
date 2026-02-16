/**
 * E2E tests for toggling between tree and grid view modes.
 * Verifies that items remain visible after switching views.
 * Note: View toggle only exists on item detail pages, not My Items root.
 */
import { test } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Items View Toggle", () => {
  test("should toggle between tree and grid views", async ({
    itemsCrud,
    itemsHierarchy,
    itemDetail,
    itemsSortFilter,
  }) => {
    // View dropdown only exists on item detail pages, not My Items root.
    // Create a parent with a child, then navigate into the parent.
    const parentName = testId("folder");
    const childName = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(parentName);
    await itemsHierarchy.addChildItem(parentName, childName);

    // Navigate fresh to ensure stable DOM after mutation, then into detail
    await itemsCrud.goto();
    await itemsCrud.expectItemVisible(parentName);
    await itemsHierarchy.clickItem(parentName);
    await itemDetail.expectDetailVisible();

    // Switch to tree and verify child is visible
    await itemsSortFilter.switchToTree();
    await itemsHierarchy.expectItemVisible(childName);

    // Switch to grid and verify child is still visible
    await itemsSortFilter.switchToGrid();
    await itemsHierarchy.expectItemVisible(childName);
  });
});
