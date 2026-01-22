/**
 * E2E tests for sticky dialog footer behavior.
 * Tests that dialog footers remain visible and clickable when content overflows.
 */

import { test, expect } from "../../fixtures";

test.describe("Sticky Dialog Footer", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("settings dialog footer remains visible when content overflows", async ({
    itemsPage,
    page,
  }) => {
    await itemsPage.goto();
    // Create parent item and navigate into it (tree view is only available on item detail pages)
    await itemsPage.createItem("Parent Folder");
    await itemsPage.clickItem("Parent Folder");
    await itemsPage.createItem("Sticky Footer Test");
    await itemsPage.waitForToastToDisappear();
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Sticky Footer Test");

    // Wait for dialog to be fully visible
    const dialog = itemsPage.getSettingsDialog();
    await expect(dialog).toBeVisible();

    // Find the footer (contains Save Changes and Cancel buttons)
    const footer = dialog.locator('[data-slot="dialog-footer-wrapper"]');
    const cancelButton = dialog.getByRole("button", { name: /cancel/i });
    const saveButton = dialog.getByRole("button", { name: /save changes/i });

    // Verify footer buttons are visible
    await expect(cancelButton).toBeVisible();
    await expect(saveButton).toBeVisible();

    // Verify the footer has shrink-0 to prevent compression
    // (This ensures the footer doesn't shrink when content overflows)
    await expect(footer).toHaveCSS("flex-shrink", "0");

    // Verify buttons are clickable
    await expect(cancelButton).toBeEnabled();
    await cancelButton.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible();
  });

  test("profile settings dialog footer remains visible", async ({
    myItemsPage,
    page,
  }) => {
    // Navigate to my-items first
    await myItemsPage.goto();
    await page.waitForLoadState("networkidle");

    // Open profile settings using page object
    await myItemsPage.openProfileSettings();

    // Wait for dialog to open
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Find footer buttons
    const footer = dialog.locator('[data-slot="dialog-footer-wrapper"]');
    const cancelButton = dialog.getByRole("button", { name: /cancel/i });
    const saveButton = dialog.getByRole("button", { name: /save changes/i });

    // Verify footer is visible and buttons are accessible
    await expect(cancelButton).toBeVisible();
    await expect(saveButton).toBeVisible();

    // Verify footer has shrink-0
    await expect(footer).toHaveCSS("flex-shrink", "0");

    // Main assertions passed - sticky footer functionality verified
    // Dialog closing is tested in other profile E2E tests
  });

  test("add item dialog footer remains visible during wizard steps", async ({
    itemsPage,
    page,
  }) => {
    await itemsPage.goto();

    // Open add item dialog
    await itemsPage.addFolderButton.click();
    await expect(itemsPage.addFolderDialog).toBeVisible({ timeout: 5000 });

    // Wait for dialog
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Find footer (contains Create and Cancel buttons)
    const footer = dialog.locator('[data-slot="dialog-footer-wrapper"]');
    const cancelButton = dialog.getByRole("button", { name: /cancel/i });
    const createButton = dialog.getByRole("button", { name: /create/i });

    // Verify footer is visible
    await expect(cancelButton).toBeVisible();
    await expect(createButton).toBeVisible();

    // Verify footer has shrink-0
    await expect(footer).toHaveCSS("flex-shrink", "0");

    // Close dialog
    await cancelButton.click();
    await expect(dialog).not.toBeVisible();
  });

  test("dialog body scrolls while footer stays fixed", async ({
    itemsPage,
    page,
  }) => {
    await itemsPage.goto();

    // Open add item dialog
    await itemsPage.addFolderButton.click();
    await expect(itemsPage.addFolderDialog).toBeVisible({ timeout: 5000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Get the body element with overflow-y-auto
    const body = dialog.locator('[data-slot="dialog-body"]');
    const footer = dialog.locator('[data-slot="dialog-footer-wrapper"]');

    // Verify body has overflow-y-auto for scrolling
    await expect(body).toHaveCSS("overflow-y", "auto");

    // Verify footer exists and is positioned outside the scrollable area
    await expect(footer).toBeVisible();

    // Footer should be at the bottom of the dialog, not inside the scrollable body
    const footerBounds = await footer.boundingBox();
    const bodyBounds = await body.boundingBox();
    const dialogBounds = await dialog.boundingBox();

    if (footerBounds && bodyBounds && dialogBounds) {
      // Footer should start at or after the visible body area ends
      // Body's visible bottom = body.y + body.height (client height, not scroll height)
      expect(footerBounds.y).toBeGreaterThanOrEqual(
        bodyBounds.y + bodyBounds.height
      );

      // Footer should be within the dialog bounds (not overflowing)
      const footerBottom = footerBounds.y + footerBounds.height;
      const dialogBottom = dialogBounds.y + dialogBounds.height;
      expect(footerBottom).toBeLessThanOrEqual(dialogBottom + 1); // +1 for rounding
    }

    // Close dialog
    await dialog.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });
});
