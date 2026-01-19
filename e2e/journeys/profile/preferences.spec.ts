/**
 * E2E tests for user preferences functionality.
 * Tests default view mode, default sort, and preference persistence.
 */

import { test, expect, prisma } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("User Preferences Journey", () => {
  let userEmail: string;
  let userId: string;

  test.beforeEach(async ({ page, signUpPage }) => {
    // Create a new user for each test
    userEmail = generateUniqueEmail("prefs");

    await signUpPage.goto();
    await signUpPage.signUp(userEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Get user ID for cleanup
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });
    userId = user!.id;
  });

  test.afterEach(async () => {
    // Cleanup
    await prisma.item.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
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
    // Create some items first
    await itemsPage.createItem("Test Item A");
    await itemsPage.createItem("Test Item B");
    await itemsPage.waitForToastToDisappear();

    // View mode is stored in localStorage via the view toggle
    // Click the tree view button to change from default grid
    await page.getByRole("button", { name: "Tree view" }).click();

    // Verify tree view is now active
    await expect(itemsPage.treeView).toBeVisible({ timeout: 10000 });
    await expect(itemsPage.gridView).not.toBeVisible();

    // Navigate away and back - localStorage should persist
    await page.goto("/docs");
    await page.goto("/my-items");
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

    // Should start on Profile tab
    await expect(page.getByRole("tabpanel")).toContainText(/email|username/i);

    // Switch to Preferences tab
    await settingsPage.goToPreferencesTab();
    await expect(page.getByRole("tabpanel")).toContainText(/view mode/i);

    // Switch to Activity tab
    await settingsPage.goToActivityTab();
    await expect(page.getByRole("tabpanel")).toContainText(/activity|history/i);

    // Switch back to Profile tab
    await settingsPage.goToProfileTab();
    await expect(page.getByRole("tabpanel")).toContainText(/email|username/i);
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
