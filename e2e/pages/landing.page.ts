/**
 * Page Object Model for the public landing page.
 * Provides methods for interacting with the hero section.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class LandingPage {
  readonly page: Page;
  readonly heroTitle: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroTitle = page.getByTestId("landing-hero-title");
  }

  /** Navigate to the landing page. */
  async goto() {
    await this.page.goto("/");
  }

  /** Verify the landing page is visible. */
  async expectVisible() {
    await expect(this.heroTitle).toBeVisible();
  }
}
