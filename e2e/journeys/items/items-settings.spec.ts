/**
 * E2E tests for Item Settings dialog.
 * Tests opening settings, renaming items, and dialog interactions.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Item Settings Dialog", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("items-settings");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("opens settings dialog via context menu", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Settings Test Folder");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Settings Test Folder");

    // Verify dialog is open with correct title
    const dialog = itemsPage.getSettingsDialog();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Item Settings")).toBeVisible();
  });

  test("shows current item name in settings dialog", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Current Name");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Current Name");

    // Verify the input shows the current name
    const nameInput = itemsPage.page.getByLabel(/^name$/i);
    await expect(nameInput).toHaveValue("Current Name");
  });

  test("can rename item via settings dialog", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Old Name");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.renameItemViaContextMenu("Old Name", "New Name");

    // Verify item is renamed in the view
    await itemsPage.expectItemVisible("New Name");
    await itemsPage.expectItemNotVisible("Old Name");
  });

  test("closes settings dialog when clicking close button", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Close Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Close Test");
    await itemsPage.closeSettingsDialog();

    // Verify dialog is closed
    await expect(itemsPage.getSettingsDialog()).not.toBeVisible();
  });

  test("disables save button when name unchanged", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Unchanged Name");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Unchanged Name");

    // Save button should be disabled when name hasn't changed
    const saveButton = itemsPage.page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeDisabled();

    // Type something different
    await itemsPage.page.getByLabel(/^name$/i).fill("Changed Name");
    await expect(saveButton).toBeEnabled();

    // Change back to original
    await itemsPage.page.getByLabel(/^name$/i).fill("Unchanged Name");
    await expect(saveButton).toBeDisabled();

    await itemsPage.closeSettingsDialog();
  });

  test("shows file summary counts in settings dialog", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Summary Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Summary Test");

    // Should show file counts (0 for each type since no files attached)
    const dialog = itemsPage.getSettingsDialog();
    // The file summary shows icons with counts
    await expect(dialog.getByText("0").first()).toBeVisible();

    await itemsPage.closeSettingsDialog();
  });
});
