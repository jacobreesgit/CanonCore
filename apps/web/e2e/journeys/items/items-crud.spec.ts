/**
 * E2E tests for item CRUD operations.
 * Covers empty state, creating items, deleting items, and item count.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Items CRUD", () => {
  test("should show empty state for new user", async ({ itemsCrud }) => {
    await itemsCrud.goto();
    await itemsCrud.expectEmptyState();
  });

  test("should create an item", async ({ itemsCrud }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemsCrud.expectItemVisible(name);
  });

  test("should delete an item", async ({ itemsCrud }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);
    await itemsCrud.expectItemVisible(name);

    await itemsCrud.deleteItemViaMenu(name);
    await itemsCrud.expectItemNotVisible(name);
  });

  test("should show correct item count", async ({ itemsCrud }) => {
    const nameA = testId("movie");
    const nameB = testId("movie");
    const nameC = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(nameA);
    await itemsCrud.createItem(nameB);
    await itemsCrud.createItem(nameC);

    await itemsCrud.expectItemCount(3);
  });

  test("should create a public item", async ({ itemsCrud }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItemWithVisibility(name, { isPublic: true });
    await itemsCrud.expectItemVisible(name);
  });
});
