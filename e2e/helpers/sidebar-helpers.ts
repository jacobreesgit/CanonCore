/**
 * Sidebar-related E2E test helpers.
 * Provides utilities for interacting with the collapsible sidebar.
 */

import { expect, type Page } from "@playwright/test";

/**
 * Opens the sidebar if it's currently closed.
 * Useful for mobile tests where sidebar is collapsed by default.
 *
 * @param page - Playwright page instance
 */
export async function openSidebarIfClosed(page: Page): Promise<void> {
  // Check if sidebar is visible by looking for a sidebar element
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const isVisible = await sidebar.isVisible().catch(() => false);

  if (!isVisible) {
    // Click the sidebar trigger to open it
    const trigger = page.getByTestId("sidebar-trigger");
    await trigger.click();
    // Wait for sidebar to be visible
    await expect(sidebar).toBeVisible();
  }
}

/**
 * Closes the sidebar if it's currently open.
 * Useful for mobile tests to restore the collapsed state.
 *
 * @param page - Playwright page instance
 */
export async function closeSidebarIfOpen(page: Page): Promise<void> {
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const isVisible = await sidebar.isVisible().catch(() => false);

  if (isVisible) {
    // Click the sidebar trigger to close it
    const trigger = page.getByTestId("sidebar-trigger");
    await trigger.click();
    // Wait for sidebar to be hidden
    await expect(sidebar).not.toBeVisible();
  }
}
