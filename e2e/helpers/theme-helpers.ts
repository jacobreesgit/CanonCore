/**
 * Theme-related E2E test helpers.
 * Provides utilities for interacting with theme toggle.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Toggles the theme using keyboard navigation.
 * Uses keyboard interaction to avoid dev overlay issues on click.
 *
 * @param page - Playwright page instance
 */
export async function toggleTheme(page: Page): Promise<void> {
  const themeToggle = page.getByTestId("theme-toggle");
  await expect(themeToggle).toBeEnabled();
  await themeToggle.focus();
  await page.keyboard.press("Enter");
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
