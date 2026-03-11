/**
 * Page object for profile settings interactions.
 * Covers opening the settings dialog/sheet, tab navigation,
 * form filling, saving, and closing on both desktop and mobile.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class SettingsPage {
  constructor(
    private page: Page,
    private isMobile: boolean
  ) {}

  // ── Open ──────────────────────────────────────────────

  /**
   * Open settings via the desktop sidebar user menu.
   * Clicks the user menu trigger, then the settings button,
   * and waits for the settings dialog to become visible.
   */
  async openDesktop() {
    // Ensure sidebar is visible (it may be collapsed)
    const sidebar = this.page.getByTestId("nav-sidebar");
    if (!(await sidebar.isVisible())) {
      await this.page.getByTestId("sidebar-trigger").click();
      await expect(sidebar).toBeVisible({ timeout: Timeouts.animation });
    }
    await this.page.getByTestId("my-items-user-menu").click();
    await this.page.getByTestId("my-items-settings-button").click();
    await expect(this.page.getByTestId("dialog-settings")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Open settings via the mobile footer account button.
   * Taps the account icon in the mobile footer nav and waits
   * for the settings sheet to become visible.
   */
  async openMobile() {
    await this.page.getByTestId("nav-mobile-account").click();
    await expect(this.page.getByTestId("sheet-settings")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /**
   * Open settings using the appropriate method for the current viewport.
   * Dispatches to openDesktop or openMobile based on the isMobile flag.
   */
  async open() {
    if (this.isMobile) {
      await this.openMobile();
    } else {
      await this.openDesktop();
    }
  }

  // ── Assertions ────────────────────────────────────────

  /**
   * Assert that the settings dialog (desktop) or sheet (mobile) is visible.
   */
  async expectOpen() {
    const testId = this.isMobile ? "sheet-settings" : "dialog-settings";
    await expect(this.page.getByTestId(testId)).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Assert that a success toast appears after saving.
   * Sonner toasts appear as list items — look for text directly.
   * .first() is needed because Sonner can render duplicate toasts,
   * and getByText strict mode fails with multiple matches.
   */
  async expectSaveSuccess() {
    await expect(this.page.getByText(/settings saved/i).first()).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  // ── Tab Navigation ────────────────────────────────────

  /**
   * Switch to a specific settings tab.
   * Desktop: clicks the tab trigger directly.
   * Mobile: opens the select dropdown and picks the tab option.
   *
   * @param tab - The tab to switch to
   */
  async switchToTab(tab: "profile" | "account" | "connections" | "activity") {
    if (this.isMobile) {
      await this.page.getByTestId("settings-tab-select").click();
      await this.page.getByTestId(`settings-tab-option-${tab}`).click();
    } else {
      await this.page.getByTestId(`settings-tab-${tab}`).click();
    }
  }

  // ── Form Interactions ─────────────────────────────────

  /**
   * Fill in the display name field on the profile tab.
   *
   * @param name - The display name to enter
   */
  async fillDisplayName(name: string) {
    const input = this.page.getByLabel(/display name/i);
    await input.waitFor({ state: "visible", timeout: Timeouts.api });
    await input.clear();
    await input.fill(name);
  }

  /**
   * Fill in the bio textarea on the profile tab.
   *
   * @param bio - The bio text to enter
   */
  async fillBio(bio: string) {
    const textarea = this.page.getByLabel(/bio/i);
    await textarea.waitFor({ state: "visible", timeout: Timeouts.api });
    await textarea.clear();
    await textarea.fill(bio);
  }

  /**
   * Fill in the username field on the profile tab.
   *
   * @param username - The username to enter
   */
  async fillUsername(username: string) {
    const input = this.page.getByLabel(/username/i);
    await input.waitFor({ state: "visible", timeout: Timeouts.api });
    await input.clear();
    await input.fill(username);
  }

  /**
   * Click the Save button to submit profile changes.
   */
  async saveProfile() {
    await this.page.getByRole("button", { name: "Save" }).click();
  }

  // ── Password Change ─────────────────────────────────

  /**
   * Navigate to the password change step on the account tab.
   * Clicks the "Change Password" button which sets the step to "password".
   */
  async openPasswordChangeStep() {
    await this.page.getByRole("button", { name: /change password/i }).click();
  }

  /**
   * Fill the current password field on the password change step.
   *
   * @param password - The current password
   */
  async fillCurrentPassword(password: string) {
    const input = this.page.getByLabel(/current password/i);
    await input.waitFor({ state: "visible", timeout: Timeouts.api });
    await input.fill(password);
  }

  /**
   * Fill the new password field on the password change step.
   *
   * @param password - The new password
   */
  async fillNewPassword(password: string) {
    const input = this.page.getByLabel(/^new password$/i);
    await input.waitFor({ state: "visible", timeout: Timeouts.api });
    await input.fill(password);
  }

  /**
   * Fill the confirm password field on the password change step.
   *
   * @param password - The password confirmation
   */
  async fillConfirmPassword(password: string) {
    const input = this.page.getByLabel(/confirm new password/i);
    await input.waitFor({ state: "visible", timeout: Timeouts.api });
    await input.fill(password);
  }

  /**
   * Click the Change Password button to submit the password change.
   * When on the password step, the footer submit button is the only
   * visible "Change Password" button (the account tab card is hidden).
   */
  async submitPasswordChange() {
    await this.page.getByTestId("password-change-submit").click();
  }

  /**
   * Assert that a password change success toast appears.
   */
  async expectPasswordChangeSuccess() {
    await expect(this.page.getByText(/password saved/i).first()).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  // ── Close ─────────────────────────────────────────────

  /**
   * Close the settings dialog or sheet.
   * Uses the Escape key which works for both desktop dialogs and mobile sheets.
   */
  async close() {
    await this.page.keyboard.press("Escape");
    const testId = this.isMobile ? "sheet-settings" : "dialog-settings";
    await expect(this.page.getByTestId(testId)).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }
}
