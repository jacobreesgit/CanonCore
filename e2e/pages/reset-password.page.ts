import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class ResetPasswordPage {
  readonly page: Page;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.passwordInput = page.getByTestId("reset-password-password-input");
    this.confirmPasswordInput = page.getByTestId(
      "reset-password-confirm-password-input"
    );
    this.submitButton = page.getByTestId("reset-password-submit-button");
    this.errorMessage = page.getByTestId("reset-password-error-message");
    this.successMessage = page.getByTestId("reset-password-success-message");
    this.signInLink = page.getByTestId("reset-password-sign-in-link");
  }

  async goto(code?: string) {
    const url = code ? `/reset-password?code=${code}` : "/reset-password";
    await this.page.goto(url);
  }

  async resetPassword(password: string, confirmPassword: string) {
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }

  async expectSuccess() {
    await expect(this.successMessage).toBeVisible();
  }

  async expectError(message: string) {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectVisible() {
    await expect(this.passwordInput).toBeVisible();
    await expect(this.confirmPasswordInput).toBeVisible();
    await expect(this.submitButton).toBeVisible();
  }
}
