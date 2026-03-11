/**
 * E2E tests for item sorting and filtering.
 * Covers sort selection, view mode switching, and filter toggling.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Items Sort & Filter", () => {
  test("should sort items by name A-Z", async ({
    itemsCrud,
    itemsSortFilter,
  }) => {
    await itemsCrud.goto();
    await itemsCrud.createItem("Banana");
    await itemsCrud.createItem("Apple");
    await itemsCrud.createItem("Cherry");

    await itemsSortFilter.selectSort("name-asc");
    await itemsSortFilter.expectSortActive("name-asc");
  });

  test("should switch between grid and tree views", async ({
    itemsCrud,
    itemsHierarchy,
    itemDetail,
    itemsSortFilter,
  }) => {
    // View dropdown only exists on item detail pages, not My Items root.
    // Create a parent with a child, navigate into the parent.
    const parentName = testId("folder");
    const childName = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(parentName);
    await itemsHierarchy.addChildItem(parentName, childName);

    // Navigate into parent's detail page
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(parentName);
    await itemDetail.expectDetailVisible();

    await itemsSortFilter.switchToTree();
    await itemsHierarchy.expectItemVisible(childName);

    await itemsSortFilter.switchToGrid();
    await itemsHierarchy.expectItemVisible(childName);
  });

  test("should filter by No Files", async ({ itemsCrud, itemsSortFilter }) => {
    const nameA = testId("movie");
    const nameB = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(nameA);
    await itemsCrud.createItem(nameB);

    await itemsSortFilter.toggleFilter("No Files");

    // All newly created items have no files, so they should remain visible
    await itemsCrud.expectItemVisible(nameA);
    await itemsCrud.expectItemVisible(nameB);
  });

  test("should clear all active filters", async ({
    itemsCrud,
    itemsSortFilter,
  }) => {
    const name = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    // Apply a filter
    await itemsSortFilter.toggleFilter("No Files");
    await itemsCrud.expectItemVisible(name);

    // Clear all filters
    await itemsSortFilter.clearFilters();

    // Item should still be visible after clearing
    await itemsCrud.expectItemVisible(name);
  });
});
