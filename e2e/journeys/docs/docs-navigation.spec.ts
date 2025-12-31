/**
 * E2E tests for Fumadocs documentation navigation.
 * Tests accessing docs via Get Help link and navigation features.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";
import { toggleTheme, expectDarkMode } from "../../helpers/theme-helpers";
import { openSidebarIfClosed } from "../../helpers/sidebar-helpers";

test.describe("Documentation Navigation", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    // Create account and sign in
    const email = generateUniqueEmail("docs");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
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

    // Check for Getting Started heading
    await expect(
      page.getByRole("heading", { name: "Getting Started" })
    ).toBeVisible();
  });

  test("can navigate back to dashboard from docs", async ({
    page,
    docsPage,
  }) => {
    await docsPage.goto();

    // Try to find the back link - it may be in sidebar (desktop) or we use content link (mobile)
    const backLink = page.getByRole("link", { name: "Back to Dashboard" });
    const isBackLinkVisible = await backLink.isVisible().catch(() => false);

    if (isBackLinkVisible) {
      // Desktop: sidebar is visible, click the back link
      await backLink.click();
    } else {
      // Mobile: use the Dashboard link from the page content
      const dashboardLink = page.getByRole("link", { name: "Dashboard" });
      await dashboardLink.click();
    }

    // Should be on dashboard
    await expect(page).toHaveURL("/dashboard");
  });

  test("docs respects dark mode setting", async ({ page, docsPage }) => {
    // Set dark mode in dashboard
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
      page.getByRole("heading", { name: "Getting Started" })
    ).toBeVisible();
  });
});
