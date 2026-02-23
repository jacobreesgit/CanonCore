/**
 * Page object for item settings dialog/sheet interactions.
 * Covers opening settings, renaming, updating descriptions,
 * TMDB search, saving, and closing.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";
import { slugify } from "../../lib/slugify";

export class ItemsSettingsPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ─────────────────────────────────────────

  /** Navigate to the user's items page. */
  async goto() {
    await this.page.goto(`/u/${this.username}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  // ── Open Settings ──────────────────────────────────────

  /**
   * Open the settings dialog or sheet for a specific item.
   * Clicks the item's more menu, then selects the "Settings" option.
   * On desktop, opens ItemSettingsDialog. On mobile, opens MobileItemSheet
   * (triggered via the combined options sheet).
   *
   * @param itemName - The name of the item to configure
   */
  async openSettings(itemName: string) {
    const slug = slugify(itemName);
    const moreButton = this.page.getByTestId(`item-more-${slug}`);
    await moreButton.waitFor({ state: "attached", timeout: Timeouts.api });
    await moreButton.click({ force: true });

    // Click the "Settings" menu item in the dropdown
    const settingsOption = this.page.getByRole("menuitem", {
      name: /settings/i,
    });
    await settingsOption.waitFor({
      state: "visible",
      timeout: Timeouts.animation,
    });
    await settingsOption.click();

    // Wait for the settings dialog or sheet to appear
    await this.expectSettingsOpen();
  }

  // ── Settings Assertions ────────────────────────────────

  /**
   * Assert that the settings dialog or sheet is currently visible.
   * Checks for dialog-settings (desktop) or sheet-item-options (mobile).
   */
  async expectSettingsOpen() {
    // Settings always opens as ItemSettingsDialog (even on mobile)
    await expect(this.page.getByTestId("dialog-item-settings")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Assert that the settings dialog or sheet is closed.
   */
  async expectSettingsClosed() {
    await expect(this.page.getByTestId("dialog-item-settings")).not.toBeVisible(
      { timeout: Timeouts.animation }
    );
  }

  // ── TMDB Tab ─────────────────────────────────────────────

  /** Switch to the TMDB tab in the settings dialog. */
  async switchToTmdbTab() {
    const tmdbTab = this.page.getByRole("tab", { name: /tmdb/i });
    await tmdbTab.waitFor({ state: "visible", timeout: Timeouts.api });
    await tmdbTab.click();
  }

  /** Assert the TMDB metadata section is visible with poster/backdrop fields. */
  async expectTmdbMetadataVisible() {
    await expect(this.page.getByText("Poster")).toBeVisible({
      timeout: Timeouts.api,
    });
    await expect(
      this.page.getByRole("button", { name: /detach/i })
    ).toBeVisible();
  }

  /** Assert the TMDB tab is no longer present (after detach). */
  async expectTmdbTabGone() {
    await expect(this.page.getByRole("tab", { name: /tmdb/i })).not.toBeVisible(
      {
        timeout: Timeouts.animation,
      }
    );
  }

  /** Click the Detach button and confirm the dialog. */
  async detachTmdb() {
    await this.page.getByRole("button", { name: /detach/i }).click();
    await expect(this.page.getByText(/are you sure/i)).toBeVisible({
      timeout: Timeouts.animation,
    });
    await this.page.getByRole("button", { name: /confirm/i }).click();
  }

  /** Click the Clear button for a specific artwork field. */
  async clearArtwork(field: "poster" | "backdrop") {
    await this.page
      .getByRole("button", { name: new RegExp(`clear ${field}`, "i") })
      .click();
  }

  // ── Form Interactions ──────────────────────────────────

  /**
   * Rename the item by clearing and filling the name field in the settings dialog.
   * The name field is a MediaSearchCombobox with role="textbox".
   *
   * @param newName - The new name to set
   */
  async rename(newName: string) {
    const nameInput = this.page.getByRole("combobox", { name: /item name/i });
    await nameInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await nameInput.clear();
    await nameInput.fill(newName);
  }

  /**
   * Update the item description field.
   *
   * @param text - The new description text
   */
  async updateDescription(text: string) {
    const descriptionInput = this.page.getByRole("textbox", {
      name: /description/i,
    });
    await descriptionInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await descriptionInput.clear();
    await descriptionInput.fill(text);
  }

  /**
   * Type a query into the TMDB search combobox to search for media metadata.
   * The combobox is within the name input field (MediaSearchCombobox).
   *
   * @param query - The search query (e.g., "The Dark Knight")
   */
  async searchTmdb(query: string) {
    const nameInput = this.page.getByRole("combobox", { name: /item name/i });
    await nameInput.waitFor({ state: "visible", timeout: Timeouts.api });
    await nameInput.clear();
    await nameInput.fill(query);

    // Wait for TMDB search results to appear (combobox listbox)
    await expect(this.page.getByRole("listbox")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  // ── Save / Close ───────────────────────────────────────

  /**
   * Save the current settings by clicking the save button.
   * Desktop: clicks "Save Changes" in the dialog footer.
   * Mobile: clicks "Save Changes" in the sheet footer.
   */
  async save() {
    const saveButton = this.page.getByRole("button", { name: /save changes/i });
    await saveButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await saveButton.click();

    // Wait for the dialog/sheet to close after successful save
    await this.expectSettingsClosed();
  }

  /**
   * Close the settings dialog or sheet without saving.
   * Desktop: clicks the dialog close button (X) or presses Escape.
   * Mobile: presses Escape to dismiss the sheet.
   */
  async close() {
    if (this.isMobile) {
      await this.page.keyboard.press("Escape");
    } else {
      // Press Escape to close the desktop dialog
      await this.page.keyboard.press("Escape");
    }

    // Wait for close animation to complete
    await this.expectSettingsClosed();
  }
}
