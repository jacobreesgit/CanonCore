/**
 * Page object for Fumadocs documentation pages.
 * Provides methods for interacting with docs navigation.
 */

import { type Page, type Locator, expect } from "@playwright/test";

export class DocsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly backToDashboard: Locator;
  readonly sidebar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator("h1");
    this.backToDashboard = page.getByRole("link", {
      name: "Back to Dashboard",
    });
    this.sidebar = page.locator('[data-sidebar="true"]');
  }

  /**
   * Navigate to the docs page.
   */
  async goto() {
    await this.page.goto("/docs");
  }

  /**
   * Verify the docs page is visible with expected elements.
   */
  async expectVisible() {
    await expect(this.heading).toBeVisible();
  }

  /**
   * Navigate back to dashboard via sidebar link.
   */
  async goBackToDashboard() {
    await this.backToDashboard.click();
  }
}
