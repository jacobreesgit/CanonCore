/**
 * E2E tests for dark mode theme toggle functionality.
 * Tests theme switching and persistence.
 */

import { test, expect } from "../../fixtures";
import {
  toggleTheme,
  expectDarkMode,
  expectLightMode,
} from "../../helpers/theme-helpers";
import {
  isMobileViewport,
  openUserSheetIfClosed,
} from "../../helpers/mobile-nav-helpers";

test.describe("Dark Mode Theme Toggle", () => {
  test.beforeEach(async ({ page, testUser }) => {
    // Use testUser fixture for consistent test setup (compatible with itemsPage)
    await expect(page).toHaveURL(`/u/${testUser.username}`, { timeout: 10000 });
  });

  test("theme toggle button is visible", async ({ page }) => {
    const isMobile = await isMobileViewport(page);

    if (isMobile) {
      // Mobile: Theme toggle is in user sheet
      await openUserSheetIfClosed(page);
      const themeButton = page
        .getByRole("dialog", { name: /account/i })
        .getByRole("button", { name: /(light mode|dark mode)/i });
      await expect(themeButton).toBeVisible();
      await page.keyboard.press("Escape");
    } else {
      // Desktop: Theme toggle is in sidebar
      const themeToggle = page.getByTestId("theme-toggle");
      await expect(themeToggle).toBeVisible();
      await expect(themeToggle).toBeEnabled();
    }
  });

  test("toggles from light to dark theme", async ({ page }) => {
    // Toggle to dark mode
    await toggleTheme(page);

    // Verify dark class is applied
    await expectDarkMode(page);
  });

  test("toggles from dark to light theme", async ({ page }) => {
    // Toggle to dark mode
    await toggleTheme(page);
    await expectDarkMode(page);

    // Toggle back to light mode
    await toggleTheme(page);
    await expectLightMode(page);
  });

  test("theme persists across page navigation", async ({ page }) => {
    // Switch to dark mode
    await toggleTheme(page);
    await expectDarkMode(page);

    // Navigate to a different page
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");

    // Theme should persist
    await expectDarkMode(page);
  });

  test("theme persists after page reload", async ({ page }) => {
    // Switch to dark mode
    await toggleTheme(page);
    await expectDarkMode(page);

    // Reload page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Theme should persist (stored in localStorage)
    await expectDarkMode(page);
  });
});
