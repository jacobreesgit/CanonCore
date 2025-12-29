import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class LandingPage {
  readonly page: Page;
  readonly heroTitle: Locator;
  readonly getStartedButton: Locator;
  readonly signInButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heroTitle = page.getByTestId("landing-hero-title");
    this.getStartedButton = page.getByTestId("landing-get-started-button");
    this.signInButton = page.getByTestId("landing-sign-in-button");
  }

  async goto() {
    await this.page.goto("/");
  }

  async clickGetStarted() {
    await this.getStartedButton.click();
  }

  async clickSignIn() {
    await this.signInButton.click();
  }

  async expectVisible() {
    await expect(this.heroTitle).toBeVisible();
  }
}
