/**
 * E2E tests for Item Settings dialog.
 * Tests opening settings, renaming items, and dialog interactions.
 */

import { test, expect } from "../../fixtures";
import {
  generateUniqueEmail,
  TEST_PASSWORD,
  SEED_USER_EMAIL,
  SEED_PASSWORD,
} from "../../helpers/test-user";

test.describe("Item Settings Dialog", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("items-settings");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
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

test.describe("Item Page Settings", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("page-settings");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("should show Settings button on item detail page (no files)", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();

    // Create an item
    await itemsPage.createItem("Test Folder");
    await itemsPage.waitForToastToDisappear();

    // Click into the item to navigate to detail page
    await itemsPage.clickItem("Test Folder");

    // Verify we're on the detail page
    await itemsPage.expectBreadcrumb("Test Folder");

    // Verify Settings button is visible
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await expect(settingsButton).toBeVisible();
  });

  test("should NOT show Settings button on root my-items page", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();

    // Create an item but stay on root
    await itemsPage.createItem("Root Item");
    await itemsPage.waitForToastToDisappear();

    // Stay on root page - verify URL
    await expect(page).toHaveURL("/my-items");

    // Verify Settings button is NOT visible
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await expect(settingsButton).not.toBeVisible();
  });

  test("should open settings dialog and show item name", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();

    // Create an item with specific name
    await itemsPage.createItem("My Test Item");
    await itemsPage.waitForToastToDisappear();

    // Navigate to item detail page
    await itemsPage.clickItem("My Test Item");

    // Click Settings button
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    // Verify settings dialog is visible
    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Verify the name input shows the item name
    const nameInput = page.getByLabel(/^name$/i);
    await expect(nameInput).toHaveValue("My Test Item");
  });

  test("should update item name and refresh breadcrumbs", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.goto();

    // Create an item with original name
    await itemsPage.createItem("Original Name");
    await itemsPage.waitForToastToDisappear();

    // Navigate to item detail page
    await itemsPage.clickItem("Original Name");
    await itemsPage.expectBreadcrumb("Original Name");

    // Click Settings button
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    // Wait for settings dialog
    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Update the name
    const nameInput = page.getByLabel(/^name$/i);
    await nameInput.fill("Updated Name");

    // Click Save button (first save button for name section)
    await page
      .getByRole("button", { name: /^save$/i })
      .first()
      .click();

    // Verify success toast
    await itemsPage.expectSuccessToast("Item renamed");

    // Wait for the input to reflect new value
    await expect(nameInput).toHaveValue("Updated Name", { timeout: 5000 });

    // Close the dialog
    await page.getByRole("button", { name: /close/i }).click();
    await expect(settingsDialog).not.toBeVisible({ timeout: 5000 });

    // Verify breadcrumb is updated
    await itemsPage.expectBreadcrumb("Updated Name");
  });

  test("should update item description", async ({ page, itemsPage }) => {
    await itemsPage.goto();

    // Create an item
    await itemsPage.createItem("Description Test");
    await itemsPage.waitForToastToDisappear();

    // Navigate to item detail page
    await itemsPage.clickItem("Description Test");

    // Click Settings button
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    // Wait for settings dialog
    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Add description
    const descriptionInput = page.getByLabel(/^description$/i);
    await descriptionInput.fill("This is a test description");

    // Click Save button (second save button for description section)
    await page
      .getByRole("button", { name: /^save$/i })
      .nth(1)
      .click();

    // Verify success toast
    await itemsPage.expectSuccessToast("Description updated");

    // Close the dialog
    await page.getByRole("button", { name: /close/i }).click();
    await expect(settingsDialog).not.toBeVisible({ timeout: 5000 });
  });
});

// Skip file selection tests if SEED_PASSWORD not configured
const describeFileSelection = SEED_PASSWORD
  ? test.describe
  : test.describe.skip;

describeFileSelection("Primary File Selection", () => {
  // These tests require seed data with SFTP-synced items
  // Use: seed@canoncore.com with "The Shawshank Redemption (1994)"

  test.beforeEach(async ({ page, signInPage }) => {
    // Sign in as seed user
    await signInPage.goto();
    await signInPage.signIn(SEED_USER_EMAIL, SEED_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("should select primary media from dropdown", async ({
    page,
    itemsPage,
  }) => {
    // Navigate to Shawshank which has 2 media files (1080p and 4K)
    await itemsPage.clickItem("Movies");
    await itemsPage.clickItem("The Shawshank Redemption (1994)");

    // Open settings via toolbar button
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    // Wait for dialog
    const dialog = page.getByRole("dialog", { name: /settings/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify media select is visible and interactive (2 files = enabled)
    const mediaSelect = page.getByRole("combobox", { name: /primary media/i });
    await expect(mediaSelect).toBeVisible();
    await expect(mediaSelect).not.toBeDisabled();

    // Select the 4K version
    await mediaSelect.click();
    await page.getByRole("option", { name: /4K.*BluRay|2160p/i }).click();

    // Verify selection persists - close and reopen
    await page.getByRole("button", { name: /close/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Reopen settings to verify persistence
    await settingsButton.click();
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // The 4K file should now be selected
    await expect(mediaSelect).toContainText(/4K|2160p/i);
  });

  test("should select primary artwork with thumbnail preview", async ({
    page,
    itemsPage,
  }) => {
    // Navigate to Shawshank which has 3 artwork files
    await itemsPage.clickItem("Movies");
    await itemsPage.clickItem("The Shawshank Redemption (1994)");

    // Open settings
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    const dialog = page.getByRole("dialog", { name: /settings/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify artwork select is visible
    const artworkSelect = page.getByRole("combobox", {
      name: /primary artwork/i,
    });
    await expect(artworkSelect).toBeVisible();
    await expect(artworkSelect).not.toBeDisabled();

    // Open dropdown to see thumbnails
    await artworkSelect.click();

    // Verify options have thumbnail images
    const options = page.getByRole("option");
    await expect(options.first()).toBeVisible();

    // Options should contain img elements
    const firstOptionImg = options.first().locator("img");
    await expect(firstOptionImg).toBeVisible();

    // Select fanart
    await page.getByRole("option", { name: /fanart/i }).click();

    // Close and reopen to verify persistence
    await page.getByRole("button", { name: /close/i }).click();
    await settingsButton.click();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(artworkSelect).toContainText(/fanart/i);
  });

  test("should select default subtitle from dropdown", async ({
    page,
    itemsPage,
  }) => {
    // Navigate to Shawshank which has 3 subtitle files (en, es, fr)
    await itemsPage.clickItem("Movies");
    await itemsPage.clickItem("The Shawshank Redemption (1994)");

    // Open settings
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    const dialog = page.getByRole("dialog", { name: /settings/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify subtitle select is visible and interactive
    const subtitleSelect = page.getByRole("combobox", {
      name: /default subtitle/i,
    });
    await expect(subtitleSelect).toBeVisible();
    await expect(subtitleSelect).not.toBeDisabled();

    // Select Spanish subtitles
    await subtitleSelect.click();
    await page.getByRole("option", { name: /\.es\.srt/i }).click();

    // Close and reopen to verify persistence
    await page.getByRole("button", { name: /close/i }).click();
    await settingsButton.click();
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await expect(subtitleSelect).toContainText(/\.es\.srt/i);
  });

  test("should show disabled select when only 1 file exists", async ({
    page,
    itemsPage,
  }) => {
    // Navigate to a movie with only 1 media file (Interstellar has 1)
    await itemsPage.clickItem("Movies");
    await itemsPage.clickItem("Interstellar (2014)");

    // Open settings
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    const dialog = page.getByRole("dialog", { name: /settings/i });
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Media select should be disabled (only 1 file)
    const mediaSelect = page.getByRole("combobox", { name: /primary media/i });
    await expect(mediaSelect).toBeVisible();
    await expect(mediaSelect).toBeDisabled();
  });
});
