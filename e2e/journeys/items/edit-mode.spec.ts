/**
 * E2E tests for edit mode and bulk actions.
 * Covers entering/exiting edit mode, bulk toolbar visibility, and bulk deletion.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Edit Mode", () => {
  test("should enter and exit edit mode", async ({ itemsCrud, itemsDrag }) => {
    const nameA = testId("movie");
    const nameB = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(nameA);
    await itemsCrud.createItem(nameB);

    await itemsDrag.enterEditMode();
    await itemsDrag.expectEditMode(true);

    await itemsDrag.exitEditMode();
    await itemsDrag.expectEditMode(false);
  });

  test("should show bulk actions toolbar when items selected", async ({
    itemsCrud,
    itemsDrag,
  }) => {
    const name = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemsDrag.enterEditMode();
    await itemsDrag.selectItem(name);
    await itemsDrag.expectBulkToolbarVisible();
  });

  test("should bulk delete selected items", async ({
    page,
    itemsCrud,
    itemsDrag,
  }) => {
    const nameA = testId("movie");
    const nameB = testId("movie");
    const nameC = testId("movie");

    await itemsCrud.goto();
    await itemsCrud.createItem(nameA);
    await itemsCrud.createItem(nameB);
    await itemsCrud.createItem(nameC);

    await itemsDrag.enterEditMode();
    await itemsDrag.selectAll();
    await itemsDrag.deleteSelected();

    // Confirm bulk deletion in the alert dialog
    const confirmButton = page.getByRole("button", { name: /^delete$/i });
    await confirmButton.click();

    await itemsCrud.expectEmptyState();
  });
});
