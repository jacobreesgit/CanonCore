/**
 * E2E tests for creating nested items via the more options menu.
 * Verifies the "Add Child Item" action produces correct hierarchy.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Add Child Item", () => {
  test("should create nested items via more menu", async ({
    itemsCrud,
    itemsHierarchy,
    itemDetail,
  }) => {
    const parentName = testId("folder");
    const childName = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(parentName);

    // Add child via the more options menu on the grid card
    await itemsHierarchy.addChildItem(parentName, childName);

    // Navigate fresh to ensure stable DOM after mutation
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(parentName);
    await itemDetail.expectDetailVisible();

    // Child should be visible in the Contents tab
    await itemsHierarchy.expectItemVisible(childName);
  });
});
