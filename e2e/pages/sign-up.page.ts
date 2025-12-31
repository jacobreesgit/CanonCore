/**
 * Page object for sign-up page.
 * Provides methods for account registration and form validation.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class SignUpPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId("sign-up-email-input");
    this.passwordInput = page.getByTestId("sign-up-password-input");
    this.confirmPasswordInput = page.getByTestId(
      "sign-up-confirm-password-input"
    );
    this.submitButton = page.getByTestId("sign-up-submit-button");
    this.errorMessage = page.getByTestId("sign-up-error-message");
    this.signInLink = page.getByTestId("sign-up-sign-in-link");
  }

  async goto() {
    await this.page.goto("/sign-up");
  }

  async signUp(email: string, password: string, confirmPassword: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
    // Wait for form submission to complete
    await this.page.waitForLoadState("networkidle");
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
