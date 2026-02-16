/**
 * Page object for authentication flows.
 * Covers sign-in, sign-up, forgot password, and reset password.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class AuthPage {
  constructor(private page: Page) {}

  // ── Sign In ──────────────────────────────────────────────

  /** Navigate to sign-in page. */
  async gotoSignIn() {
    await this.page.goto("/sign-in");
  }

  /** Fill and submit sign-in form. */
  async signIn(email: string, password: string) {
    const emailInput = this.page.getByTestId("sign-in-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(email);
    await this.page.getByTestId("sign-in-password-input").fill(password);
    await this.page.getByTestId("sign-in-submit-button").click();
  }

  /** Expect sign-in form is visible. */
  async expectSignInVisible() {
    await expect(this.page.getByTestId("sign-in-email-input")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /** Expect sign-in error message. */
  async expectSignInError(message: string) {
    await expect(this.page.getByTestId("sign-in-error-message")).toContainText(
      message,
      { timeout: Timeouts.api }
    );
  }

  // ── Sign Up ──────────────────────────────────────────────

  /** Navigate to sign-up page. */
  async gotoSignUp() {
    await this.page.goto("/sign-up");
  }

  /** Fill and submit sign-up form. */
  async signUp(
    email: string,
    password: string,
    confirmPassword: string,
    username?: string
  ) {
    const emailInput = this.page.getByTestId("sign-up-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(email);
    if (username) {
      await this.page.getByTestId("sign-up-username-input").fill(username);
    }
    await this.page.getByTestId("sign-up-password-input").fill(password);
    await this.page
      .getByTestId("sign-up-confirm-password-input")
      .fill(confirmPassword);
    const submitBtn = this.page.getByTestId("sign-up-submit-button");
    await submitBtn.waitFor({ state: "visible", timeout: Timeouts.animation });
    await submitBtn.click();
  }

  /** Expect sign-up error message. */
  async expectSignUpError(message: string) {
    await expect(this.page.getByTestId("sign-up-error-message")).toContainText(
      message,
      { timeout: Timeouts.api }
    );
  }

  // ── Forgot Password ─────────────────────────────────────

  /** Navigate to forgot password page. */
  async gotoForgotPassword() {
    await this.page.goto("/forgot-password");
  }

  /** Submit forgot password form. */
  async requestPasswordReset(email: string) {
    const emailInput = this.page.getByTestId("forgot-password-email-input");
    await emailInput.waitFor({ state: "visible", timeout: Timeouts.upload });
    await emailInput.fill(email);
    const submitBtn = this.page.getByTestId("forgot-password-submit-button");
    await submitBtn.waitFor({ state: "visible", timeout: Timeouts.animation });
    await submitBtn.click();
  }

  /** Expect forgot password success. */
  async expectForgotPasswordSuccess() {
    await expect(
      this.page.getByTestId("forgot-password-success-message")
    ).toBeVisible({ timeout: Timeouts.api });
  }

  // ── Reset Password ──────────────────────────────────────

  /** Navigate to reset password page. */
  async gotoResetPassword(code?: string) {
    const url = code ? `/reset-password?code=${code}` : "/reset-password";
    await this.page.goto(url);
  }

  /** Submit reset password form. */
  async resetPassword(password: string, confirmPassword: string) {
    await this.page.getByTestId("reset-password-password-input").fill(password);
    await this.page
      .getByTestId("reset-password-confirm-password-input")
      .fill(confirmPassword);
    await this.page.getByTestId("reset-password-submit-button").click();
  }

  /** Expect reset password success. */
  async expectResetPasswordSuccess() {
    await expect(
      this.page.getByTestId("reset-password-success-message")
    ).toBeVisible({ timeout: Timeouts.api });
  }
}
