/**
 * E2E tests for moving items via the MoveToDialog.
 * Covers reparenting an item to a different folder.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { Timeouts } from "../../config/timeouts";

test.describe("Move Item", () => {
  test("should move item to a different parent", async ({
    page,
    itemsCrud,
    itemsHierarchy,
    itemDetail,
  }) => {
    const folderA = testId("folder-a");
    const folderB = testId("folder-b");
    const childName = testId("child");

    // Create two folders and a child in folder A
    await itemsCrud.goto();
    await itemsCrud.createItem(folderA);
    await itemsCrud.createItem(folderB);
    await itemsHierarchy.addChildItem(folderA, childName);

    // Navigate into folder A to verify child exists
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(folderA);
    await itemDetail.expectDetailVisible();
    await itemsCrud.expectItemVisible(childName);

    // Open the more menu on the child item and click "Move to..."
    await itemsCrud.openMoreMenu(childName);
    await page.getByRole("menuitem", { name: /move to/i }).click();

    // Wait for the move dialog to appear
    const moveDialog = page.getByRole("dialog", { name: /move/i });
    await expect(moveDialog).toBeVisible({ timeout: Timeouts.api });

    // Select folder B as the destination (tree picker renders folders as buttons)
    await moveDialog.getByRole("button", { name: folderB }).click();

    // Click the Move button and wait for the dialog to close
    await moveDialog.getByRole("button", { name: "Move", exact: true }).click();
    await expect(moveDialog).not.toBeVisible({ timeout: Timeouts.heavy });

    // The child should no longer be in folder A
    await itemsCrud.expectItemNotVisible(childName);

    // Navigate to folder B and verify the child is there
    await itemsCrud.goto();
    await itemsHierarchy.clickItem(folderB);
    await itemDetail.expectDetailVisible();
    await itemsCrud.expectItemVisible(childName);
  });
});
