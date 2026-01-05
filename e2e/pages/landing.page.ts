/**
 * Page Object Model for the public landing page.
 * Provides methods for interacting with hero section and CTA button.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class LandingPage {
  readonly page: Page;
  readonly heroTitle: Locator;
  readonly ctaButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroTitle = page.getByTestId("landing-hero-title");
    this.ctaButton = page.getByTestId("landing-cta-button");
  }

  /** Navigate to the landing page. */
  async goto() {
    await this.page.goto("/");
  }

  /** Click the CTA button (Get Started for guests, Go to Dashboard for authenticated). */
  async clickGetStarted() {
    await this.ctaButton.click();
  }

  /** Verify the landing page is visible. */
  async expectVisible() {
    await expect(this.heroTitle).toBeVisible();
  }
}
