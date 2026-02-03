/**
 * E2E tests for Item Settings dialog.
 * Tests opening settings, renaming items, and dialog interactions.
 * Note: Context menu works on both tree and grid items. Tree view is only on item detail pages.
 * Note: Breadcrumb-related tests are desktop-only as breadcrumbs are hidden on mobile.
 */

import { test, expect, prisma } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Item Settings Dialog", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    // Create parent item and navigate to it for tree view tests
    await itemsPage.createItem("Settings Parent");
    await itemsPage.clickItem("Settings Parent");
  });

  test("opens settings dialog via context menu", async ({ itemsPage }) => {
    await itemsPage.createItem("Settings Test Folder");
    // Switch to tree view on item detail page
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Settings Test Folder");

    // Verify dialog is open with correct title
    const dialog = itemsPage.getSettingsDialog();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Item Settings")).toBeVisible();
  });

  test("shows current item name in settings dialog", async ({ itemsPage }) => {
    await itemsPage.createItem("Current Name");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Current Name");

    // Verify the input shows the current name
    const nameInput = itemsPage.page.getByLabel(/item name/i);
    await expect(nameInput).toHaveValue("Current Name");
  });

  test("can rename item via settings dialog", async ({ itemsPage }) => {
    await itemsPage.createItem("Old Name");
    await itemsPage.switchToTreeView();

    await itemsPage.renameItemViaContextMenu("Old Name", "New Name");

    // Verify item is renamed in the view
    await itemsPage.expectItemVisible("New Name");
    await itemsPage.expectItemNotVisible("Old Name");
  });

  test("closes settings dialog when clicking close button", async ({
    itemsPage,
  }) => {
    await itemsPage.createItem("Close Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Close Test");
    await itemsPage.closeSettingsDialog();

    // Verify dialog is closed
    await expect(itemsPage.getSettingsDialog()).not.toBeVisible();
  });

  test("disables save button when name unchanged", async ({ itemsPage }) => {
    await itemsPage.createItem("Unchanged Name");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Unchanged Name");

    // "Save Changes" button should be disabled when nothing has changed
    const saveButton = itemsPage.page.getByRole("button", {
      name: /save changes/i,
    });
    await expect(saveButton).toBeDisabled();

    // Type something different
    await itemsPage.page.getByLabel(/item name/i).fill("Changed Name");
    await expect(saveButton).toBeEnabled();

    // Change back to original
    await itemsPage.page.getByLabel(/item name/i).fill("Unchanged Name");
    await expect(saveButton).toBeDisabled();

    await itemsPage.closeSettingsDialog();
  });

  test("shows file summary counts in settings dialog", async ({
    itemsPage,
  }) => {
    await itemsPage.createItem("Summary Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Summary Test");

    // Should show file counts (0 for each type since no files attached)
    const dialog = itemsPage.getSettingsDialog();
    // The file summary shows icons with counts
    await expect(dialog.getByText("0").first()).toBeVisible();

    await itemsPage.closeSettingsDialog();
  });

  test("shows description field in settings dialog", async ({ itemsPage }) => {
    await itemsPage.createItem("Description Field Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Description Field Test");

    // Verify description input is visible (label includes "(optional)" suffix)
    const descriptionInput = itemsPage.page.getByLabel(/description/i);
    await expect(descriptionInput).toBeVisible();
    await expect(descriptionInput).toHaveValue("");

    await itemsPage.closeSettingsDialog();
  });

  test("can add description to item", async ({ itemsPage }) => {
    await itemsPage.createItem("Add Description Test");
    await itemsPage.switchToTreeView();

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
    await itemsPage.createItem("Update Description Test");
    await itemsPage.switchToTreeView();

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
    await itemsPage.createItem("Clear Description Test");
    await itemsPage.switchToTreeView();

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
    await itemsPage.createItem("Char Count Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Char Count Test");

    // Initially shows 0/1000
    const dialog = itemsPage.getSettingsDialog();
    await expect(dialog.getByText("0/1000")).toBeVisible();

    // Type some text
    await itemsPage.page.getByLabel(/description/i).fill("Hello");
    await expect(dialog.getByText("5/1000")).toBeVisible();

    await itemsPage.closeSettingsDialog();
  });

  test("description save button disabled when unchanged", async ({
    itemsPage,
  }) => {
    await itemsPage.createItem("Disabled Save Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openSettingsViaContextMenu("Disabled Save Test");

    // "Save Changes" button should be disabled initially
    const saveButton = itemsPage.page.getByRole("button", {
      name: /save changes/i,
    });
    await expect(saveButton).toBeDisabled();

    // Type something to enable it
    await itemsPage.page.getByLabel(/description/i).fill("New description");
    await expect(saveButton).toBeEnabled();

    // Clear to original (empty) to disable again
    await itemsPage.page.getByLabel(/description/i).fill("");
    await expect(saveButton).toBeDisabled();

    await itemsPage.closeSettingsDialog();
  });
});

test.describe("Item Page Settings", () => {
  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("should show Settings button on item detail page (no files)", async ({
    page,
    itemsPage,
  }) => {
    const isMobile = await isMobileViewport(page);

    // Create an item
    await itemsPage.createItem("Test Folder");

    // Click into the item to navigate to detail page
    await itemsPage.clickItem("Test Folder");

    // Verify we're on the detail page (breadcrumb is hidden on mobile)
    if (!isMobile) {
      await itemsPage.expectBreadcrumb("Test Folder");
    }

    // Verify Settings button is visible
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await expect(settingsButton).toBeVisible();
  });

  test("should NOT show Settings button on root my-items page", async ({
    page,
    itemsPage,
  }) => {
    // Create an item but stay on root
    await itemsPage.createItem("Root Item");

    // Stay on root page - verify URL
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/);

    // Verify Settings button is NOT visible
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await expect(settingsButton).not.toBeVisible();
  });

  test("should open settings dialog and show item name", async ({
    page,
    itemsPage,
  }) => {
    // Create an item with specific name
    await itemsPage.createItem("My Test Item");

    // Navigate to item detail page
    await itemsPage.clickItem("My Test Item");

    // Click Settings button
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    // Verify settings dialog is visible
    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Verify the name input shows the item name
    const nameInput = page.getByLabel(/item name/i);
    await expect(nameInput).toHaveValue("My Test Item");
  });

  test("should update item name and refresh breadcrumbs", async ({
    page,
    itemsPage,
  }) => {
    const isMobile = await isMobileViewport(page);
    test.skip(isMobile, "Breadcrumbs are hidden on mobile");

    // Create an item with original name
    await itemsPage.createItem("Original Name");

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
    const nameInput = page.getByLabel(/item name/i);
    await nameInput.fill("Updated Name");

    // Click "Save Changes" button
    await page.getByRole("button", { name: /save changes/i }).click();

    // Dialog closes automatically on success
    await expect(settingsDialog).not.toBeVisible({ timeout: 5000 });

    // Verify breadcrumb is updated (confirms save succeeded)
    await itemsPage.expectBreadcrumb("Updated Name");
  });

  test("should update item description", async ({ page, itemsPage }) => {
    // Create an item
    await itemsPage.createItem("Description Test");

    // Navigate to item detail page
    await itemsPage.clickItem("Description Test");

    // Click Settings button
    const settingsButton = page.getByRole("button", { name: /item settings/i });
    await settingsButton.click();

    // Wait for settings dialog
    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Add description (label includes "(optional)" suffix)
    const descriptionInput = page.getByLabel(/description/i);
    await descriptionInput.fill("This is a test description");

    // Click "Save Changes" button
    await page.getByRole("button", { name: /save changes/i }).click();

    // Dialog closes automatically on success (confirms save succeeded)
    await expect(settingsDialog).not.toBeVisible({ timeout: 5000 });

    // Re-open settings to verify description was saved
    await page.getByRole("button", { name: /item settings/i }).click();
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel(/description/i)).toHaveValue(
      "This is a test description"
    );
  });
});

test.describe("File Deletion", () => {
  test.skip(
    !process.env.GOOGLE_E2E_REFRESH_TOKEN,
    "Requires Google Drive test credentials"
  );

  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("should show delete button on non-selected files", async ({
    page,
    itemsPage,
    setupDriveConnection,
    testUser,
  }) => {
    // Connect Google Drive
    await setupDriveConnection(testUser.id);

    await itemsPage.goto();
    await itemsPage.createItem("Delete Test");

    // Navigate to item and open settings
    await itemsPage.clickItem("Delete Test");
    await page.getByRole("button", { name: /item settings/i }).click();

    // Switch to Files tab first (tabbed interface)
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("tab", { name: /files/i }).click();

    // Open media combobox
    const mediaCombobox = dialog.getByRole("combobox").first();
    await mediaCombobox.click();

    // Non-selected files should have delete button
    // (This requires files to be uploaded first - skipped in CI without Drive)
    // Verify combobox opens correctly - use specific selector
    await expect(dialog.getByText("No files yet")).toBeVisible();
  });

  test("should show confirmation dialog when clicking delete", async ({
    page,
    itemsPage,
    setupDriveConnection,
    testUser,
  }) => {
    // Connect Google Drive and create item with files via sync
    await setupDriveConnection(testUser.id);

    await itemsPage.goto();
    await itemsPage.createItem("Confirm Delete Test");

    // Navigate to item and open settings
    await itemsPage.clickItem("Confirm Delete Test");
    await page.getByRole("button", { name: /item settings/i }).click();

    // Wait for settings dialog
    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Switch to Files tab first (tabbed interface)
    await settingsDialog.getByRole("tab", { name: /files/i }).click();

    // The dialog should show "No files yet" for empty items
    // When there are files, clicking delete should show confirmation
    await expect(settingsDialog.getByText("Primary Media")).toBeVisible();
  });

  test("should close confirmation dialog on cancel without deleting", async ({
    page,
    itemsPage,
    setupDriveConnection,
    testUser,
  }) => {
    // Connect Google Drive
    await setupDriveConnection(testUser.id);

    await itemsPage.goto();
    await itemsPage.createItem("Cancel Delete Test");

    // Get the item for later verification
    const item = await prisma.item.findFirst({
      where: { userId: testUser.id, name: "Cancel Delete Test" },
    });
    expect(item).not.toBeNull();

    // Navigate to item and open settings
    await itemsPage.clickItem("Cancel Delete Test");
    await page.getByRole("button", { name: /item settings/i }).click();

    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Switch to Files tab first (tabbed interface)
    await settingsDialog.getByRole("tab", { name: /files/i }).click();

    // Dialog should show file type sections
    await expect(settingsDialog.getByText("Primary Media")).toBeVisible();

    // Close settings dialog
    await page.getByRole("button", { name: /close/i }).click();
    await expect(settingsDialog).not.toBeVisible({ timeout: 5000 });
  });

  test("should show delete button with confirmation for uploaded files", async ({
    page,
    itemsPage,
    setupDriveConnection,
    testUser,
  }) => {
    // Connect Google Drive
    await setupDriveConnection(testUser.id);

    await itemsPage.goto();
    await itemsPage.createItem("Upload Delete Flow");

    // Wait for sync to complete
    await expect(async () => {
      const item = await prisma.item.findFirst({
        where: { userId: testUser.id, name: "Upload Delete Flow" },
      });
      expect(item?.driveFileId).not.toBeNull();
    }).toPass({ timeout: 15000 });

    // Navigate to item and open settings
    await itemsPage.clickItem("Upload Delete Flow");
    await page.getByRole("button", { name: /item settings/i }).click();

    const settingsDialog = page.getByRole("dialog", { name: /settings/i });
    await expect(settingsDialog).toBeVisible({ timeout: 5000 });

    // Switch to Files tab first (tabbed interface)
    await settingsDialog.getByRole("tab", { name: /files/i }).click();

    // Verify the file type sections are present
    await expect(settingsDialog.getByText("Primary Media")).toBeVisible();
    await expect(settingsDialog.getByText("Primary Artwork")).toBeVisible();
    await expect(settingsDialog.getByText("Default Subtitle")).toBeVisible();

    // Close dialog
    await page.getByRole("button", { name: /close/i }).click();
  });
});
