/**
 * Page object for sign-in page.
 * Provides methods for authentication and error handling.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class SignInPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId("sign-in-email-input");
    this.passwordInput = page.getByTestId("sign-in-password-input");
    this.submitButton = page.getByTestId("sign-in-submit-button");
    this.errorMessage = page.getByTestId("sign-in-error-message");
    this.forgotPasswordLink = page.getByTestId("sign-in-forgot-password-link");
    this.signUpLink = page.getByTestId("sign-in-sign-up-link");
  }

  async goto() {
    await this.page.goto("/sign-in");
  }

  async signIn(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    // Wait for form submission to complete (button disables during loading)
    await this.page.waitForLoadState("networkidle");
  }

  async expectError(message: string) {
    // Wait with longer timeout for async auth operations
    await expect(this.errorMessage).toBeVisible({ timeout: 15000 });
    await expect(this.errorMessage).toContainText(message);
  }

  async expectVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
