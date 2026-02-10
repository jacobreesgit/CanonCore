/**
 * E2E tests for user preferences functionality.
 * Tests default view mode, default sort, and preference persistence.
 */

import { test, expect } from "../../fixtures";
import { isMobileViewport } from "../../helpers/mobile-nav-helpers";

test.describe("User Preferences Journey", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("should set and persist default view mode", async ({
    page,
    settingsPage,
    itemsPage,
  }) => {
    // Open settings and go to preferences tab
    await settingsPage.openFromNavUser();
    await settingsPage.goToPreferencesTab();

    // Verify we're on preferences tab (default is grid view)
    const initialMode = await settingsPage.getSelectedViewMode();
    expect(initialMode).toBe("grid");

    // Select Tree view to change it
    await settingsPage.selectViewMode("tree");
    await settingsPage.expectPreferencesSavedToast();

    // Verify preference was saved
    const newMode = await settingsPage.getSelectedViewMode();
    expect(newMode).toBe("tree");

    // Close settings
    await settingsPage.close();

    // Reload the page
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    // Verify tree view is now the default
    await expect(
      itemsPage.treeView.or(page.getByText(/no items yet/i))
    ).toBeVisible({
      timeout: 10000,
    });

    // Re-open settings to verify preference persisted
    await settingsPage.openFromNavUser();
    await settingsPage.goToPreferencesTab();
    const persistedMode = await settingsPage.getSelectedViewMode();
    expect(persistedMode).toBe("tree");
  });

  test("should set and persist default sort option", async ({
    page,
    settingsPage,
    itemsPage,
  }) => {
    // Open settings and go to preferences tab
    await settingsPage.openFromNavUser();
    await settingsPage.goToPreferencesTab();

    // Select "Name A-Z" as default sort
    await settingsPage.selectDefaultSort("Name A-Z");
    await settingsPage.expectPreferencesSavedToast();

    // Close settings
    await settingsPage.close();

    // Reload the page
    await page.reload();
    await itemsPage.waitForLoadingComplete();

    // Re-open settings to verify preference persisted
    await settingsPage.openFromNavUser();
    await settingsPage.goToPreferencesTab();
    const persistedSort = await settingsPage.getSelectedDefaultSort();
    expect(persistedSort).toContain("Name A-Z");
  });

  test("should apply view mode preference on my-items page", async ({
    page,
    itemsPage,
  }) => {
    // Create parent container and navigate into it (tree view only on item detail pages)
    await itemsPage.createItem("Parent Item");
    await itemsPage.clickItem("Parent Item");

    // Create children inside the parent
    await itemsPage.createItem("Child Item A");
    await itemsPage.createItem("Child Item B");

    // Wait for grid view items to be visible (ensures toolbar is loaded)
    await expect(itemsPage.gridView).toBeVisible({ timeout: 10000 });

    // View mode is stored in localStorage via the view toggle
    // Click the tree view button to change from default grid
    await itemsPage.switchToTreeView();

    // Verify tree view is now active
    await expect(itemsPage.treeView).toBeVisible({ timeout: 10000 });
    await expect(itemsPage.gridView).not.toBeVisible();

    // Navigate away and back - localStorage should persist
    await page.goto("/docs");
    await page.waitForLoadState("domcontentloaded");

    // Navigate back to the item detail page (tree view is only on detail pages)
    await itemsPage.goto();
    await itemsPage.waitForLoadingComplete();
    await itemsPage.clickItem("Parent Item");
    await itemsPage.waitForLoadingComplete();

    // Tree view should still be applied (persisted in localStorage)
    await expect(itemsPage.treeView).toBeVisible({ timeout: 10000 });
    await expect(itemsPage.gridView).not.toBeVisible();
  });

  test("should allow switching between tabs", async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.openFromNavUser();
    const isMobile = await isMobileViewport(page);

    // Helper to get the visible tabpanel
    // On mobile (SwipeableTabs), multiple tabpanels exist but only active is visible
    const getVisiblePanel = () =>
      isMobile
        ? page.locator('[role="tabpanel"]:not(.hidden)').first()
        : page.getByRole("tabpanel");

    // Should start on Profile tab (has Display Name, Profile Picture, Hero Banner)
    await expect(getVisiblePanel()).toContainText(
      /display name|profile picture/i
    );

    // Switch to Preferences tab
    await settingsPage.goToPreferencesTab();
    await expect(getVisiblePanel()).toContainText(/view mode/i);

    // Switch to Activity tab
    await settingsPage.goToActivityTab();
    await expect(getVisiblePanel()).toContainText(/activity|history|no sync/i);

    // Switch back to Profile tab
    await settingsPage.goToProfileTab();
    await expect(getVisiblePanel()).toContainText(
      /display name|profile picture/i
    );
  });

  test("should show toast notification on preference save", async ({
    settingsPage,
    page,
  }) => {
    await settingsPage.openFromNavUser();
    await settingsPage.goToPreferencesTab();

    // Change view mode
    const currentMode = await settingsPage.getSelectedViewMode();
    const newMode = currentMode === "grid" ? "tree" : "grid";
    await settingsPage.selectViewMode(newMode);

    // Toast should appear
    await settingsPage.expectPreferencesSavedToast();

    // Verify toast eventually disappears
    await expect(
      page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /preferences saved/i })
    ).not.toBeVisible({ timeout: 10000 });
  });
});
