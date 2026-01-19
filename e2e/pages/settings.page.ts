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

  // ==================== Tab Navigation ====================

  /**
   * Switches to the Profile tab.
   */
  async goToProfileTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Profile" }).click();
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
    // Wait for auto-save to complete
    await this.page.waitForLoadState("networkidle");
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
    // Wait for auto-save to complete
    await this.page.waitForLoadState("networkidle");
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
   * Sets the username in the profile settings.
   *
   * @param username - The username to set
   */
  async setUsername(username: string): Promise<void> {
    const input = this.page.locator("#settings-username");
    await input.fill(username);
  }

  /**
   * Gets the current username value.
   */
  async getUsername(): Promise<string> {
    const input = this.page.locator("#settings-username");
    return (await input.inputValue()) ?? "";
  }

  /**
   * Waits for username validation to complete.
   * Validation has a 500ms debounce, so we wait for the spinner to appear then disappear.
   */
  async waitForUsernameValidation(): Promise<void> {
    // Wait longer than the 500ms debounce delay for the API call to start
    await this.page.waitForTimeout(600);
    // Wait for the result text to appear (either "available" or "taken")
    const resultText = this.page.locator("text=/username is (available|already taken)/i");
    await resultText.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
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
    const switchEl = this.page.locator("#settings-public");
    await switchEl.click();
  }

  /**
   * Checks if public profile is enabled.
   */
  async isPublicProfileEnabled(): Promise<boolean> {
    const switchEl = this.page.locator("#settings-public");
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
   * Clicks the Save Changes button.
   */
  async saveChanges(): Promise<void> {
    await this.page.getByRole("button", { name: "Save Changes" }).click();
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Expects a success toast for settings updated.
   */
  async expectSettingsSavedToast(): Promise<void> {
    const toast = this.page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /settings updated/i });
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
