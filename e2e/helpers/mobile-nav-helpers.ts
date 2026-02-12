/**
 * Mobile navigation E2E test helpers.
 * Provides utilities for interacting with mobile footer nav and bottom sheets.
 *
 * @deprecated For desktop tests, use sidebar-helpers.ts instead.
 * This module replaces sidebar-helpers for mobile viewports.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Opens the help bottom sheet if it's not already open.
 *
 * @param page - Playwright page instance
 */
export async function openHelpSheetIfClosed(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog", { name: /get help/i });
  if (!(await sheet.isVisible())) {
    const helpButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /help/i });
    await helpButton.click();
    await expect(sheet).toBeVisible();
  }
}

/**
 * Opens the user/settings bottom sheet if it's not already open.
 * Account button now opens MobileSettingsSheet directly.
 *
 * @param page - Playwright page instance
 */
export async function openUserSheetIfClosed(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog", { name: /settings/i });
  if (!(await sheet.isVisible())) {
    const accountButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /account/i });
    await accountButton.click();
    await expect(sheet).toBeVisible();
  }
}

/**
 * Opens the settings bottom sheet if it's not already open (guest users only).
 *
 * @param page - Playwright page instance
 */
export async function openSettingsSheetIfClosed(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog", { name: /settings/i });
  if (!(await sheet.isVisible())) {
    const settingsButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /settings/i });
    await settingsButton.click();
    await expect(sheet).toBeVisible();
  }
}

/**
 * Closes any open bottom sheet via Escape key.
 *
 * @param page - Playwright page instance
 */
export async function closeSheetIfOpen(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog");
  if (await sheet.isVisible()) {
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();
  }
}

/**
 * Closes any open bottom sheet by tapping the overlay backdrop.
 *
 * @param page - Playwright page instance
 */
export async function closeSheetByBackdrop(page: Page): Promise<void> {
  const overlay = page.locator("[data-vaul-overlay]");
  if (await overlay.isVisible()) {
    await overlay.click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
}

/**
 * Navigates to My Items via footer nav (authenticated users).
 *
 * @param page - Playwright page instance
 */
export async function navigateToMyItems(page: Page): Promise<void> {
  const myItemsButton = page
    .getByRole("navigation", { name: /mobile navigation/i })
    .getByRole("link", { name: /my items/i });
  await myItemsButton.click();
}

/**
 * Navigates to Explore via footer nav.
 *
 * @param page - Playwright page instance
 */
export async function navigateToExplore(page: Page): Promise<void> {
  const exploreButton = page
    .getByRole("navigation", { name: /mobile navigation/i })
    .getByRole("link", { name: /explore/i });
  await exploreButton.click();
}

/**
 * Navigates to Sign In via footer nav (guest users).
 *
 * @param page - Playwright page instance
 */
export async function navigateToSignIn(page: Page): Promise<void> {
  const signInButton = page
    .getByRole("navigation", { name: /mobile navigation/i })
    .getByRole("link", { name: /sign in/i });
  await signInButton.click();
}

/**
 * Signs out via the settings sheet (mobile).
 * Opens settings, navigates to Account tab, clicks Sign out.
 *
 * @param page - Playwright page instance
 */
export async function signOutViaMobile(page: Page): Promise<void> {
  await openSettingsViaMobile(page);
  // Settings sheet uses Select dropdown when >3 tabs
  const selectTrigger = page.getByRole("combobox", {
    name: /settings tabs/i,
  });
  await selectTrigger.click();
  await page.getByRole("option", { name: /account/i }).click();
  const signOutButton = page.getByRole("button", { name: /sign out/i });
  await signOutButton.click();
}

/**
 * Opens settings sheet from mobile footer (mobile).
 * Account button now opens MobileSettingsSheet directly.
 *
 * @param page - Playwright page instance
 */
export async function openSettingsViaMobile(page: Page): Promise<void> {
  const sheet = page.getByRole("dialog", { name: /settings/i });
  if (!(await sheet.isVisible())) {
    const accountButton = page
      .getByRole("navigation", { name: /mobile navigation/i })
      .getByRole("button", { name: /account/i });
    await accountButton.click();
    await expect(sheet).toBeVisible();
  }
}

/**
 * Checks if the mobile footer is visible.
 *
 * @param page - Playwright page instance
 * @returns True if footer is visible
 */
export async function isMobileFooterVisible(page: Page): Promise<boolean> {
  const footer = page.getByRole("navigation", { name: /mobile navigation/i });
  return footer.isVisible();
}

/**
 * Waits for the mobile footer to be visible.
 *
 * @param page - Playwright page instance
 */
export async function waitForMobileFooter(page: Page): Promise<void> {
  const footer = page.getByRole("navigation", { name: /mobile navigation/i });
  await expect(footer).toBeVisible();
}

/**
 * Checks if user is on mobile viewport by checking viewport width.
 * Mobile is defined as viewport width < 1024px (lg breakpoint).
 *
 * @param page - Playwright page instance
 * @returns True if on mobile viewport
 */
export async function isMobileViewport(page: Page): Promise<boolean> {
  const viewport = page.viewportSize();
  if (viewport) {
    return viewport.width < 1024;
  }
  // Fallback to checking footer visibility if viewport not available
  return isMobileFooterVisible(page);
}
