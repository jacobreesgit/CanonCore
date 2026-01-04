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

    // First save button (for name) should be disabled when name hasn't changed
    const nameSaveButton = itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .first();
    await expect(nameSaveButton).toBeDisabled();

    // Type something different
    await itemsPage.page.getByLabel(/^name$/i).fill("Changed Name");
    await expect(nameSaveButton).toBeEnabled();

    // Change back to original
    await itemsPage.page.getByLabel(/^name$/i).fill("Unchanged Name");
    await expect(nameSaveButton).toBeDisabled();

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

  test("shows description field in settings dialog", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Description Field Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Description Field Test");

    // Verify description input is visible
    const descriptionInput = itemsPage.page.getByLabel(/^description$/i);
    await expect(descriptionInput).toBeVisible();
    await expect(descriptionInput).toHaveValue("");

    await itemsPage.closeSettingsDialog();
  });

  test("can add description to item", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Add Description Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.updateDescriptionViaContextMenu(
      "Add Description Test",
      "This is a test description"
    );

    // Re-open to verify it persisted
    await itemsPage.openSettingsViaContextMenu("Add Description Test");
    const description = await itemsPage.getDescriptionFromSettingsDialog();
    expect(description).toBe("This is a test description");

    await itemsPage.closeSettingsDialog();
  });

  test("can update description", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Update Description Test");
    await itemsPage.waitForToastToDisappear();

    // Add initial description
    await itemsPage.updateDescriptionViaContextMenu(
      "Update Description Test",
      "Initial description"
    );

    // Update description
    await itemsPage.updateDescriptionViaContextMenu(
      "Update Description Test",
      "Updated description"
    );

    // Verify update persisted
    await itemsPage.openSettingsViaContextMenu("Update Description Test");
    const description = await itemsPage.getDescriptionFromSettingsDialog();
    expect(description).toBe("Updated description");

    await itemsPage.closeSettingsDialog();
  });

  test("can clear description", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Clear Description Test");
    await itemsPage.waitForToastToDisappear();

    // Add description first
    await itemsPage.updateDescriptionViaContextMenu(
      "Clear Description Test",
      "Will be cleared"
    );

    // Clear description
    await itemsPage.updateDescriptionViaContextMenu(
      "Clear Description Test",
      ""
    );

    // Verify cleared
    await itemsPage.openSettingsViaContextMenu("Clear Description Test");
    const description = await itemsPage.getDescriptionFromSettingsDialog();
    expect(description).toBe("");

    await itemsPage.closeSettingsDialog();
  });

  test("shows character count for description", async ({ itemsPage }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Char Count Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Char Count Test");

    // Initially shows 0/200
    const dialog = itemsPage.getSettingsDialog();
    await expect(dialog.getByText("0/200")).toBeVisible();

    // Type some text
    await itemsPage.page.getByLabel(/^description$/i).fill("Hello");
    await expect(dialog.getByText("5/200")).toBeVisible();

    await itemsPage.closeSettingsDialog();
  });

  test("description save button disabled when unchanged", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Disabled Save Test");
    await itemsPage.waitForToastToDisappear();

    await itemsPage.openSettingsViaContextMenu("Disabled Save Test");

    // Second save button (for description) should be disabled initially
    const descSaveButton = itemsPage.page
      .getByRole("button", { name: /^save$/i })
      .nth(1);
    await expect(descSaveButton).toBeDisabled();

    // Type something to enable it
    await itemsPage.page.getByLabel(/^description$/i).fill("New description");
    await expect(descSaveButton).toBeEnabled();

    // Clear to original (empty) to disable again
    await itemsPage.page.getByLabel(/^description$/i).fill("");
    await expect(descSaveButton).toBeDisabled();

    await itemsPage.closeSettingsDialog();
  });
});
