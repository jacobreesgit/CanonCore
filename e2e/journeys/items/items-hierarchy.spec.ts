/**
 * E2E tests for item hierarchy (parent-child relationships).
 * Covers adding child items via more menu and collapsing/expanding tree nodes.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Items Hierarchy", () => {
  test("should add a child item via more menu", async ({
    itemsCrud,
    itemsHierarchy,
    itemDetail,
  }) => {
    const parentName = testId("folder");
    const childName = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(parentName);

    await itemsHierarchy.addChildItem(parentName, childName);

    // Navigate into parent to verify child
    // Go back to My Items first (addChildItem may have navigated away)
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(parentName);
    await itemDetail.expectDetailVisible();
    await itemsHierarchy.expectItemVisible(childName);
  });

  test("should collapse and expand tree items", async ({
    itemsCrud,
    itemsHierarchy,
    itemDetail,
    isMobile,
  }) => {
    test.skip(isMobile, "More button requires hover (not available on mobile)");

    // Need 3 levels: root > subfolder > movie
    // On root's detail page in tree view, subfolder has children
    // so it gets a collapse/expand toggle.
    const rootName = testId("folder");
    const subfolderName = testId("folder");
    const childName = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(rootName);
    await itemsHierarchy.addChildItem(rootName, subfolderName);

    // Navigate into root to see subfolder
    // Go back to My Items first (addChildItem may have navigated away)
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(rootName);
    await itemDetail.expectDetailVisible();
    await itemsHierarchy.expectItemVisible(subfolderName);

    // Add child to subfolder (creates 3rd level)
    await itemsHierarchy.addChildItem(subfolderName, childName);

    // Navigate back to root's detail page (addChildItem may navigate away)
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(rootName);
    await itemDetail.expectDetailVisible();

    // Switch to tree view to see nested hierarchy
    await itemsHierarchy.switchToTree();
    await itemsHierarchy.expectItemVisible(subfolderName);
    await itemsHierarchy.expectItemVisible(childName);

    // Collapse subfolder — child should disappear
    await itemsHierarchy.collapseItem(subfolderName);
    await itemsHierarchy.expectItemNotVisible(childName);

    // Expand subfolder — child should reappear
    await itemsHierarchy.expandItem(subfolderName);
    await itemsHierarchy.expectItemVisible(childName);
  });
});
