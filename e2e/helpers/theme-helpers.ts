/**
 * Theme-related E2E test helpers.
 * Provides utilities for interacting with theme toggle.
 */

import { expect, type Page } from "@playwright/test";
import { isMobileViewport, openUserSheetIfClosed } from "./mobile-nav-helpers";

/**
 * Toggles the theme using keyboard navigation.
 * Uses keyboard interaction to avoid dev overlay issues on click.
 * Handles both desktop (sidebar) and mobile (user sheet) layouts.
 *
 * @param page - Playwright page instance
 */
export async function toggleTheme(page: Page): Promise<void> {
  const isMobile = await isMobileViewport(page);

  if (isMobile) {
    // Mobile: Theme toggle is in the user sheet
    await openUserSheetIfClosed(page);
    // Find the theme toggle button (Light Mode / Dark Mode)
    const themeButton = page
      .getByRole("dialog", { name: /account/i })
      .getByRole("button", { name: /(light mode|dark mode)/i });
    await themeButton.click();
    // Wait for theme to apply
    await page.waitForTimeout(200);
    // Close the sheet after toggling
    await page.keyboard.press("Escape");
    // Wait for sheet to fully close and DOM to update
    const sheet = page.getByRole("dialog", { name: /account/i });
    await expect(sheet).not.toBeVisible({ timeout: 5000 });
  } else {
    // Desktop: Theme toggle is in sidebar
    const themeToggle = page.getByTestId("theme-toggle");
    await expect(themeToggle).toBeEnabled();
    await themeToggle.focus();
    await page.keyboard.press("Enter");
  }
}

/**
 * Verifies the page is in dark mode.
 *
 * @param page - Playwright page instance
 */
export async function expectDarkMode(page: Page): Promise<void> {
  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);
}

/**
 * Verifies the page is in light mode.
 *
 * @param page - Playwright page instance
 */
export async function expectLightMode(page: Page): Promise<void> {
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
}
