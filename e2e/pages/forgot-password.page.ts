import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class ForgotPasswordPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly backToSignInLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId("forgot-password-email-input");
    this.submitButton = page.getByTestId("forgot-password-submit-button");
    this.errorMessage = page.getByTestId("forgot-password-error-message");
    this.successMessage = page.getByTestId("forgot-password-success-message");
    this.backToSignInLink = page.getByTestId(
      "forgot-password-back-to-sign-in-link"
    );
  }

  async goto() {
    await this.page.goto("/forgot-password");
  }

  async requestPasswordReset(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async expectSuccess() {
    await expect(this.successMessage).toBeVisible();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectVisible() {
    await expect(this.emailInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
