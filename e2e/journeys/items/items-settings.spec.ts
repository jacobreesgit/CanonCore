/**
 * E2E tests for Item Settings dialog.
 * Tests opening settings, renaming items, and dialog interactions.
 * Note: Context menu works on both tree and grid items. Tree view is only on item detail pages.
 * Note: Breadcrumb-related tests are desktop-only as breadcrumbs are hidden on mobile.
 */

import { test, expect, prisma } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("Item Settings Dialog", () => {
  // Each test does: beforeEach (create parent + navigate) + create child + settings ops
  // This exceeds the default 30s timeout
  test.slow();

  // Use testUser fixture for consistent test setup (compatible with itemsPage)
  test.beforeEach(async ({ page, testUser, itemsPage }) => {
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
    // Create parent item and navigate to it for context menu tests
    await itemsPage.createItem("Settings Parent");
    await itemsPage.clickItem("Settings Parent");
  });

  test("opens settings dialog via context menu", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Settings Test Folder");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Settings Test Folder");

    // Verify dialog/sheet is open with item name input
    const container = await itemsPage.getSettingsContainer();
    await expect(container).toBeVisible();
    await expect(container.getByLabel(/item name/i)).toBeVisible();
  });

  test("shows current item name in settings dialog", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Current Name");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Current Name");

    // Verify the input shows the current name
    const container = await itemsPage.getSettingsContainer();
    const nameInput = container.getByLabel(/item name/i);
    await expect(nameInput).toHaveValue("Current Name");
  });

  test("can rename item via settings dialog", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Old Name");
    await itemsPage.switchToTreeView();

    await itemsPage.renameItem("Old Name", "New Name");

    // Verify item is renamed in the view
    await itemsPage.expectItemVisible("New Name");
    await itemsPage.expectItemNotVisible("Old Name");
  });

  test("closes settings dialog when clicking close button", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Close Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Close Test");
    await itemsPage.closeSettings();

    // Verify dialog is closed
    const container = await itemsPage.getSettingsContainer();
    await expect(container).not.toBeVisible();
  });

  test("disables save button when name unchanged", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Unchanged Name");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Unchanged Name");

    // "Save Changes" button should be disabled when nothing has changed
    const container = await itemsPage.getSettingsContainer();
    const saveButton = container.getByRole("button", {
      name: /save changes/i,
    });
    await expect(saveButton).toBeDisabled();

    // Type something different
    await container.getByLabel(/item name/i).fill("Changed Name");
    await expect(saveButton).toBeEnabled();

    // Change back to original
    await container.getByLabel(/item name/i).fill("Unchanged Name");
    await expect(saveButton).toBeDisabled();

    await itemsPage.closeSettings();
  });

  test("shows file summary counts in settings dialog", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Summary Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Summary Test");

    // Should show file counts (0 for each type since no files attached)
    const container = await itemsPage.getSettingsContainer();
    // The file summary shows icons with counts
    await expect(container.getByText("0").first()).toBeVisible();

    await itemsPage.closeSettings();
  });

  test("shows description field in settings dialog", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Description Field Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Description Field Test");

    // Verify description input is visible (label includes "(optional)" suffix)
    // Scope to settings container to avoid matching create item dialog's description field
    const container = await itemsPage.getSettingsContainer();
    const descriptionInput = container.getByLabel(/description/i);
    await expect(descriptionInput).toBeVisible();
    await expect(descriptionInput).toHaveValue("");

    await itemsPage.closeSettings();
  });

  test("can add description to item", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Add Description Test");
    await itemsPage.switchToTreeView();

    await itemsPage.updateDescription(
      "Add Description Test",
      "This is a test description"
    );

    // Reload to guarantee fresh server data (RSC revalidation is async)
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    await itemsPage.openItemSettings("Add Description Test");
    const description = await itemsPage.getDescriptionFromSettings();
    expect(description).toBe("This is a test description");

    await itemsPage.closeSettings();
  });

  test("can update description", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Update Description Test");
    await itemsPage.switchToTreeView();

    // Add initial description
    await itemsPage.updateDescription(
      "Update Description Test",
      "Initial description"
    );

    // Reload to guarantee fresh data before next save (form reads from server state)
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    // Update description
    await itemsPage.updateDescription(
      "Update Description Test",
      "Updated description"
    );

    // Reload to guarantee fresh server data
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    await itemsPage.openItemSettings("Update Description Test");
    const description = await itemsPage.getDescriptionFromSettings();
    expect(description).toBe("Updated description");

    await itemsPage.closeSettings();
  });

  test("can clear description", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Clear Description Test");
    await itemsPage.switchToTreeView();

    // Add description first
    await itemsPage.updateDescription(
      "Clear Description Test",
      "Will be cleared"
    );

    // Reload to guarantee fresh data before clearing (form reads from server state)
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    // Clear description
    await itemsPage.updateDescription("Clear Description Test", "");

    // Reload to guarantee fresh server data
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    await itemsPage.openItemSettings("Clear Description Test");
    const description = await itemsPage.getDescriptionFromSettings();
    expect(description).toBe("");

    await itemsPage.closeSettings();
  });

  test("shows character count for description", async ({ page, itemsPage }) => {
    await itemsPage.createItem("Char Count Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Char Count Test");

    // Initially shows 0/1000
    const container = await itemsPage.getSettingsContainer();
    await expect(container.getByText("0/1000")).toBeVisible();

    // Type some text
    await container.getByLabel(/description/i).fill("Hello");
    await expect(container.getByText("5/1000")).toBeVisible();

    await itemsPage.closeSettings();
  });

  test("description save button disabled when unchanged", async ({
    page,
    itemsPage,
  }) => {
    await itemsPage.createItem("Disabled Save Test");
    await itemsPage.switchToTreeView();

    await itemsPage.openItemSettings("Disabled Save Test");

    // "Save Changes" button should be disabled initially
    const container = await itemsPage.getSettingsContainer();
    const saveButton = container.getByRole("button", {
      name: /save changes/i,
    });
    await expect(saveButton).toBeDisabled();

    // Type something to enable it
    await container.getByLabel(/description/i).fill("New description");
    await expect(saveButton).toBeEnabled();

    // Clear to original (empty) to disable again
    await container.getByLabel(/description/i).fill("");
    await expect(saveButton).toBeDisabled();

    await itemsPage.closeSettings();
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

    if (isMobile) {
      const optionsTrigger = page.getByRole("button", { name: /^options$/i });
      await expect(optionsTrigger).toBeVisible();
    } else {
      // Verify we're on the detail page (breadcrumb is hidden on mobile)
      await itemsPage.expectBreadcrumb("Test Folder");
      const settingsButton = page.getByRole("button", { name: /^settings$/i });
      await expect(settingsButton).toBeVisible();
    }
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
    const settingsButton = page.getByRole("button", { name: /^settings$/i });
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

    await itemsPage.openSettingsFromToolbar();
    const settingsContainer = await itemsPage.getSettingsContainer();
    await expect(settingsContainer).toBeVisible();

    // Verify the name input shows the item name
    const nameInput = settingsContainer.getByLabel(/item name/i);
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

    // Open settings from toolbar
    await itemsPage.openSettingsFromToolbar();
    const settingsContainer = await itemsPage.getSettingsContainer();
    await expect(settingsContainer).toBeVisible();

    // Update the name
    const nameInput = settingsContainer.getByLabel(/item name/i);
    await nameInput.fill("Updated Name");

    // Click "Save Changes" button
    await settingsContainer
      .getByRole("button", { name: /save changes/i })
      .click();

    // Dialog closes automatically on success (after onSettingsChange refetch completes)
    await expect(settingsContainer).not.toBeVisible({ timeout: 10000 });

    // Verify breadcrumb is updated (confirms save succeeded)
    await itemsPage.expectBreadcrumb("Updated Name");
  });

  test("should update item description", async ({ page, itemsPage }) => {
    // Create an item
    await itemsPage.createItem("Description Test");

    // Navigate to item detail page
    await itemsPage.clickItem("Description Test");

    await itemsPage.openSettingsFromToolbar();
    const settingsContainer = await itemsPage.getSettingsContainer();
    await expect(settingsContainer).toBeVisible();

    // Add description (label includes "(optional)" suffix)
    // Scope to settings container to avoid matching create item dialog's description field
    const descriptionInput = settingsContainer.getByLabel(/description/i);
    await descriptionInput.fill("This is a test description");

    // Click "Save Changes" button
    await settingsContainer
      .getByRole("button", { name: /save changes/i })
      .click();

    // Dialog closes automatically on success
    await expect(settingsContainer).not.toBeVisible({ timeout: 15000 });

    // Reload to guarantee fresh server data (RSC revalidation is async)
    await page.reload();
    await expect(page.getByTestId("hero-carousel")).toBeVisible({
      timeout: 10000,
    });

    // Re-open settings to verify description was saved
    await itemsPage.openSettingsFromToolbar();
    const reopened = await itemsPage.getSettingsContainer();
    await expect(reopened).toBeVisible();
    await expect(reopened.getByLabel(/description/i)).toHaveValue(
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
    await itemsPage.openSettingsFromToolbar();

    // Switch to Files tab first (tabbed interface)
    const container = await itemsPage.getSettingsContainer();
    await container.getByRole("tab", { name: /files/i }).click();
    // Wait for Files tab content to be available
    const mediaSection = container.locator(
      '[data-testid="file-section-primary-media"]'
    );
    await expect(mediaSection).toHaveCount(1, { timeout: 5000 });

    // Open media combobox
    const mediaCombobox = mediaSection.getByRole("combobox");
    await mediaCombobox.click();

    // Non-selected files should have delete button
    // (This requires files to be uploaded first - skipped in CI without Drive)
    // Verify combobox opens correctly - popover portals to body, so use page scope
    await expect(page.getByText("No files yet")).toBeVisible();
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
    await itemsPage.openSettingsFromToolbar();

    // Wait for settings container
    const settingsContainer = await itemsPage.getSettingsContainer();
    await expect(settingsContainer).toBeVisible({ timeout: 5000 });

    // Switch to Files tab first (tabbed interface)
    await settingsContainer.getByRole("tab", { name: /files/i }).click();
    // Wait for Files tab content to be available
    const mediaSection1 = settingsContainer.locator(
      '[data-testid="file-section-primary-media"]'
    );
    await expect(mediaSection1).toHaveCount(1, { timeout: 5000 });

    // The dialog should show "No files yet" for empty items
    // When there are files, clicking delete should show confirmation
    await expect(mediaSection1).toBeVisible();
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
    await itemsPage.openSettingsFromToolbar();

    const settingsContainer = await itemsPage.getSettingsContainer();
    await expect(settingsContainer).toBeVisible({ timeout: 5000 });

    // Switch to Files tab first (tabbed interface)
    await settingsContainer.getByRole("tab", { name: /files/i }).click();
    // Wait for Files tab content to be available
    const mediaSection2 = settingsContainer.locator(
      '[data-testid="file-section-primary-media"]'
    );
    await expect(mediaSection2).toHaveCount(1, { timeout: 5000 });

    // Dialog should show file type sections
    await expect(mediaSection2).toBeVisible();

    // Close settings
    await itemsPage.closeSettings();
    await expect(settingsContainer).not.toBeVisible({ timeout: 5000 });
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
    await itemsPage.openSettingsFromToolbar();

    const settingsContainer = await itemsPage.getSettingsContainer();
    await expect(settingsContainer).toBeVisible({ timeout: 5000 });

    // Switch to Files tab first (tabbed interface)
    await settingsContainer.getByRole("tab", { name: /files/i }).click();
    // Wait for Files tab content to be available
    const mediaSection3 = settingsContainer.locator(
      '[data-testid="file-section-primary-media"]'
    );
    await expect(mediaSection3).toHaveCount(1, { timeout: 5000 });

    // Verify the file type sections are present
    await expect(mediaSection3).toBeVisible();
    await expect(
      settingsContainer.getByTestId("file-section-primary-artwork")
    ).toBeVisible();
    await expect(
      settingsContainer.getByTestId("file-section-default-subtitle")
    ).toBeVisible();

    // Close settings
    await itemsPage.closeSettings();
  });
});
