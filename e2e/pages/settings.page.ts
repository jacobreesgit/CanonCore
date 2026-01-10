/**
 * Page Object Model for the Settings dialog.
 * Handles Google Drive connection, profile settings, and preferences.
 */

import type { Page } from "@playwright/test";

export class SettingsPage {
  constructor(private page: Page) {}

  /**
   * Opens Settings dialog from the nav user menu.
   * Handles mobile sidebar being collapsed.
   */
  async openFromNavUser(): Promise<void> {
    const userMenu = this.page.getByTestId("my-items-user-menu");
    const sidebarTrigger = this.page.getByTestId("sidebar-trigger");

    // On mobile, sidebar is collapsed - need to open it first
    const isUserMenuVisible = await userMenu.isVisible();
    if (!isUserMenuVisible) {
      await sidebarTrigger.click();
      await userMenu.waitFor({ state: "visible", timeout: 5000 });
    }

    await userMenu.click();
    await this.page.getByTestId("my-items-settings-button").click();
    await this.page.getByRole("dialog").waitFor({ state: "visible" });
  }

  /**
   * Closes the Settings dialog.
   */
  async close(): Promise<void> {
    await this.page.getByRole("button", { name: "Close" }).click();
    await this.page.getByRole("dialog").waitFor({ state: "hidden" });
  }

  /**
   * Clicks the Connect Google Drive button.
   */
  async clickConnectGoogleDrive(): Promise<void> {
    await this.page
      .getByRole("button", { name: /connect google drive/i })
      .click();
  }

  /**
   * Clicks the Disconnect button (trash icon).
   */
  async clickDisconnect(): Promise<void> {
    // The disconnect button has sr-only text "Disconnect"
    await this.page
      .getByRole("button", { name: /disconnect/i })
      .first()
      .click();
  }

  /**
   * Confirms disconnect in the confirmation dialog.
   */
  async confirmDisconnect(): Promise<void> {
    await this.page.getByRole("button", { name: /^disconnect$/i }).click();
  }

  /**
   * Gets the connected Google account email displayed.
   */
  async getConnectedEmail(): Promise<string | null> {
    const element = this.page.getByTestId("google-account-email");
    if (await element.isVisible()) {
      return element.textContent();
    }
    return null;
  }

  /**
   * Checks if the Google Drive connection section shows as connected.
   */
  async isConnected(): Promise<boolean> {
    const connectedBadge = this.page.getByText("Connected");
    return connectedBadge.isVisible();
  }

  /**
   * Checks if the reconnect badge is visible.
   */
  async needsReconnect(): Promise<boolean> {
    const badge = this.page
      .locator('[data-slot="badge"]')
      .filter({ hasText: /reconnect/i });
    return badge.isVisible();
  }
}
