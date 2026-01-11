/**
 * Page Object Model for Spotlight Search functionality.
 */

import { Page, expect } from "@playwright/test";

export class SpotlightPage {
  constructor(private page: Page) {}

  /** Get the spotlight dialog */
  get dialog() {
    return this.page.getByRole("dialog");
  }

  /** Get the search input */
  get searchInput() {
    return this.page.getByPlaceholder(/search items/i);
  }

  /** Open spotlight with keyboard shortcut */
  async openWithKeyboard() {
    await this.page.keyboard.press("/");
  }

  /** Open spotlight via sidebar button */
  async openViaSidebar() {
    await this.page
      .getByRole("button", { name: /search/i })
      .first()
      .click();
  }

  /** Search for items */
  async search(query: string) {
    await this.searchInput.fill(query);
  }

  /** Click on a search result */
  async selectResult(name: string) {
    await this.page.getByRole("option", { name }).click();
  }

  /** Verify spotlight is open */
  async expectOpen() {
    await expect(this.dialog).toBeVisible();
  }

  /** Verify spotlight is closed */
  async expectClosed() {
    await expect(this.dialog).not.toBeVisible();
  }

  /** Verify search result is visible */
  async expectResultVisible(name: string) {
    await expect(this.page.getByRole("option", { name })).toBeVisible();
  }

  /** Verify empty state is shown */
  async expectNoResults() {
    await expect(this.page.getByText(/no items found/i)).toBeVisible();
  }
}
