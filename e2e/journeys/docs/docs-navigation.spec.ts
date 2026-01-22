/**
 * E2E tests for Fumadocs documentation navigation.
 * Tests accessing docs via Get Help link and navigation features.
 */

import { test, expect } from "../../fixtures";
import { toggleTheme, expectDarkMode } from "../../helpers/theme-helpers";
import { openSidebarIfClosed } from "../../helpers/sidebar-helpers";

test.describe("Documentation Navigation", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("can navigate to docs via Get Help link", async ({ page }) => {
    // Open sidebar if collapsed (mobile)
    await openSidebarIfClosed(page);

    // Click Get Help link in sidebar
    const getHelpLink = page.getByRole("link", { name: "Get Help" });
    await getHelpLink.click();

    // Should be on docs page
    await expect(page).toHaveURL("/docs");
  });

  test("docs page renders with heading", async ({ page, docsPage }) => {
    await docsPage.goto();
    await docsPage.expectVisible();

    // Check for Welcome heading
    await expect(
      page.getByRole("heading", { name: "Welcome to CanonCore" })
    ).toBeVisible();
  });

  test("can navigate back to my items from docs", async ({
    page,
    docsPage,
  }) => {
    await docsPage.goto();

    // Open sidebar if collapsed (mobile) - Back to My Items is in our sidebar
    await openSidebarIfClosed(page);

    // Click the back link in sidebar
    const backLink = page.getByRole("link", { name: "Back to My Items" });
    await backLink.click();

    // Should be on user profile page
    await expect(page).toHaveURL(/\/u\/[a-zA-Z0-9_]+$/);
  });

  test("docs respects dark mode setting", async ({ page, docsPage }) => {
    // Set dark mode in my items
    await toggleTheme(page);
    await expectDarkMode(page);

    // Navigate to docs
    await docsPage.goto();

    // Docs should also be in dark mode
    await expectDarkMode(page);
  });

  test("docs page is accessible without authentication", async ({ page }) => {
    // Sign out first by clearing cookies
    await page.context().clearCookies();

    // Navigate directly to docs
    await page.goto("/docs");

    // Should be able to view docs without being redirected
    await expect(page).toHaveURL("/docs");
    await expect(
      page.getByRole("heading", { name: "Welcome to CanonCore" })
    ).toBeVisible();
  });
});
