/**
 * Page Object Model for the Settings dialog.
 * Handles Google Drive connection, profile settings, and preferences.
 */

import type { Page } from "@playwright/test";
import {
  isMobileViewport,
  openSettingsViaMobile,
} from "../helpers/mobile-nav-helpers";

export class SettingsPage {
  constructor(private page: Page) {}

  /**
   * Opens Settings dialog from the nav user menu.
   * Handles both desktop (sidebar) and mobile (footer sheet) navigation.
   */
  async openFromNavUser(): Promise<void> {
    const isMobile = await isMobileViewport(this.page);

    if (isMobile) {
      // Mobile: Open account sheet via footer, then settings
      await openSettingsViaMobile(this.page);
    } else {
      // Desktop: Open sidebar if collapsed, then user menu
      const userMenu = this.page.getByTestId("my-items-user-menu");
      const sidebarTrigger = this.page.getByTestId("sidebar-trigger");

      const isUserMenuVisible = await userMenu.isVisible();
      if (!isUserMenuVisible) {
        await sidebarTrigger.click();
        await userMenu.waitFor({ state: "visible", timeout: 5000 });
      }

      await userMenu.click();
      await this.page.getByTestId("my-items-settings-button").click();
    }

    // Wait for settings dialog to be visible
    await this.page.getByRole("dialog").waitFor({ state: "visible" });

    // Wait for AnimatedDialogContent animation to complete (250ms fade-in)
    // The Profile tab is the default tab
    await this.page.getByRole("tab", { name: "Profile" }).waitFor({
      state: "visible",
      timeout: 1000,
    });
  }

  /**
   * Closes the Settings dialog.
   * Uses specific selector to avoid matching mobile sidebar which also has role="dialog".
   */
  async close(): Promise<void> {
    await this.page.getByRole("button", { name: "Close" }).click();
    // Wait for the settings dialog specifically (not the mobile sidebar)
    // The settings dialog has data-slot="dialog-content"
    await this.page
      .locator('[role="dialog"][data-slot="dialog-content"]')
      .waitFor({ state: "hidden" });
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

  // ==================== Tab Navigation ====================

  /**
   * Switches to the Profile tab.
   */
  async goToProfileTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Profile" }).click();
    // Wait for Profile tab content to be visible (Display Name is always in Profile tab)
    await this.page.getByLabel("Display Name").waitFor({
      state: "visible",
      timeout: 5000,
    });
  }

  /**
   * Switches to the Account tab.
   */
  async goToAccountTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Account" }).click();
    // Wait for "Change Username" button to be visible (indicates tab content loaded)
    await this.page.getByRole("button", { name: /change username/i }).waitFor({
      state: "visible",
      timeout: 5000,
    });
  }

  /**
   * Switches to the Connections tab.
   */
  async goToConnectionsTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Connections" }).click();
    // Wait for Google Drive section to be visible (using label which contains the text)
    await this.page.getByText("Google Drive").first().waitFor({
      state: "visible",
      timeout: 3000,
    });
  }

  /**
   * Switches to the Preferences tab.
   */
  async goToPreferencesTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Preferences" }).click();
  }

  /**
   * Switches to the Activity tab.
   */
  async goToActivityTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Activity" }).click();
  }

  // ==================== Preferences Tab Methods ====================

  /**
   * Selects a view mode (grid or tree) in preferences.
   *
   * @param mode - The view mode to select
   */
  async selectViewMode(mode: "grid" | "tree"): Promise<void> {
    // Radio buttons are labeled "Grid" and "Tree" in the UI
    const label = mode === "grid" ? "Grid" : "Tree";
    await this.page.getByRole("radio", { name: label }).click();
    // Wait for auto-save toast to confirm save completed
    await this.expectPreferencesSavedToast();
  }

  /**
   * Gets the currently selected view mode.
   */
  async getSelectedViewMode(): Promise<"grid" | "tree"> {
    const gridRadio = this.page.getByRole("radio", { name: "Grid" });
    const isGridChecked = await gridRadio.isChecked();
    return isGridChecked ? "grid" : "tree";
  }

  /**
   * Selects a default sort option in preferences.
   *
   * @param option - The sort option label to select
   */
  async selectDefaultSort(option: string): Promise<void> {
    // Click the select trigger (shadcn Select uses combobox role)
    // The trigger is the only combobox in preferences tab
    await this.page.getByRole("combobox").click();
    // Select the option
    await this.page.getByRole("option", { name: option }).click();
    // Wait for auto-save toast to confirm save completed
    await this.expectPreferencesSavedToast();
  }

  /**
   * Gets the currently selected default sort option.
   */
  async getSelectedDefaultSort(): Promise<string> {
    const combobox = this.page.getByRole("combobox");
    return (await combobox.textContent()) ?? "";
  }

  /**
   * Expects a success toast for preferences saved.
   */
  async expectPreferencesSavedToast(): Promise<void> {
    const toast = this.page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /preferences saved/i });
    await toast.waitFor({ state: "visible", timeout: 5000 });
  }

  // ==================== Profile Tab Methods ====================

  /**
   * Opens the Change Username step from the Account tab.
   */
  async openChangeUsername(): Promise<void> {
    await this.page.getByRole("button", { name: /change username/i }).click();
    // Wait for step to open
    await this.page.getByRole("heading", { name: /change username/i }).waitFor({
      state: "visible",
      timeout: 5000,
    });
  }

  /**
   * Sets the username in the username change step.
   *
   * @param username - The username to set
   * @param password - The current password for verification
   */
  async setUsername(username: string, password?: string): Promise<void> {
    // Fill new username
    const usernameInput = this.page.getByLabel("New Username");
    await usernameInput.fill(username);

    // Fill password if provided
    if (password) {
      const passwordInput = this.page.getByLabel("Current Password");
      await passwordInput.fill(password);
    }
  }

  /**
   * Submits the username change form.
   */
  async submitUsernameChange(): Promise<void> {
    await this.page
      .locator('[data-slot="dialog-footer"]')
      .getByRole("button", { name: /change username/i })
      .click();

    // Wait for success toast
    await this.page.getByText(/username saved/i).waitFor({
      state: "visible",
      timeout: 5000,
    });

    // Wait for username step to close and return to main settings
    // Check that the "Change Username" heading is no longer visible
    await this.page.getByRole("heading", { name: /change username/i }).waitFor({
      state: "hidden",
      timeout: 5000,
    });

    // Wait for main settings to be stable (tabs should be visible)
    await this.page.getByRole("tab", { name: "Profile" }).waitFor({
      state: "visible",
      timeout: 5000,
    });
  }

  /**
   * Gets the current username value.
   */
  async getUsername(): Promise<string> {
    const input = this.page.getByTestId("settings-username-input");
    return (await input.inputValue()) ?? "";
  }

  /**
   * Waits for username validation to complete.
   * Uses condition-based polling instead of arbitrary timeout.
   */
  async waitForUsernameValidation(): Promise<void> {
    // Wait for validation result to appear (covers 500ms debounce + API call)
    const resultText = this.page.getByText(
      /username is (available|already taken)/i
    );
    await resultText
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});
  }

  /**
   * Checks if username shows as available.
   */
  async isUsernameAvailable(): Promise<boolean> {
    const successText = this.page.getByText(/username is available/i);
    // Wait up to 3 seconds for the text to appear
    try {
      await successText.waitFor({ state: "visible", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if username shows as taken.
   */
  async isUsernameTaken(): Promise<boolean> {
    const errorText = this.page.getByText(/username is already taken/i);
    // Wait up to 3 seconds for the text to appear
    try {
      await errorText.waitFor({ state: "visible", timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Toggles the public profile switch.
   */
  async togglePublicProfile(): Promise<void> {
    const switchEl = this.page.getByTestId("settings-public-toggle");
    // Wait for the switch to be visible before clicking
    // Playwright's click() automatically waits for actionable state
    await switchEl.waitFor({ state: "visible", timeout: 5000 });
    await switchEl.click();
  }

  /**
   * Checks if public profile is enabled.
   */
  async isPublicProfileEnabled(): Promise<boolean> {
    const switchEl = this.page.getByTestId("settings-public-toggle");
    const checked = await switchEl.getAttribute("data-state");
    return checked === "checked";
  }

  /**
   * Confirms making profile public in the confirmation dialog.
   */
  async confirmMakePublic(): Promise<void> {
    await this.page.getByRole("button", { name: "Make Public" }).click();
  }

  /**
   * Cancels making profile public in the confirmation dialog.
   */
  async cancelMakePublic(): Promise<void> {
    await this.page.getByRole("button", { name: "Keep Private" }).click();
  }

  /**
   * Clicks the Save Changes button and waits for confirmation.
   */
  async saveChanges(): Promise<void> {
    await this.page.getByRole("button", { name: "Save Changes" }).click();
    // Wait for the save to complete by checking for the success toast
    await this.expectSettingsSavedToast();
  }

  /**
   * Expects a success toast for settings updated.
   */
  async expectSettingsSavedToast(): Promise<void> {
    const toast = this.page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /settings saved/i });
    await toast.waitFor({ state: "visible", timeout: 5000 });
  }

  /**
   * Gets the public profile URL preview text.
   */
  async getPublicUrlPreview(): Promise<string> {
    const preview = this.page.getByText(/canoncore.com\/u\//);
    return (await preview.textContent()) ?? "";
  }
}
