/**
 * Page object for sign-up page.
 * Provides methods for account registration and form validation.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class SignUpPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId("sign-up-email-input");
    this.usernameInput = page.getByTestId("sign-up-username-input");
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

  /**
   * Signs up a new user with the provided credentials.
   *
   * @param email - User's email address
   * @param password - User's password
   * @param confirmPassword - Password confirmation
   * @param username - Optional username for profile URL
   */
  async signUp(
    email: string,
    password: string,
    confirmPassword: string,
    username?: string
  ) {
    // Wait for form to be ready
    await this.emailInput.waitFor({ state: "visible", timeout: 15000 });
    await this.emailInput.fill(email);
    if (username) {
      await this.usernameInput.fill(username);
      // Wait for username validation to complete - look for success message
      await this.page.getByText("Username is available").waitFor({
        state: "visible",
        timeout: 10000,
      });
    }
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
