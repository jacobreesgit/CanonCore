/**
 * Page object for playlist interactions.
 * Covers creating playlists, adding items, navigating detail pages,
 * and managing playlists via the profile playlist section.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class PlaylistPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ──────────────────────────────────────────

  /** Navigate to the user's profile page (where playlist section lives). */
  async gotoProfile() {
    await this.page.goto(`/u/${this.username}`);
    await this.page.waitForLoadState("domcontentloaded");
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /** Switch to the Playlists tab on the profile page. */
  async switchToPlaylistsTab() {
    await this.page
      .getByRole("tab", { name: "Playlists" })
      .click({ timeout: Timeouts.api });
  }

  /**
   * Navigate to a playlist detail page by URL.
   *
   * @param playlistId - The playlist ID
   */
  async gotoPlaylist(playlistId: string) {
    await this.page.goto(`/u/${this.username}/playlists/${playlistId}`);
    await this.page.waitForLoadState("domcontentloaded");
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Add to Playlist Dialog ──────────────────────────────

  /**
   * Open the "Add to Playlist" dialog via the detail settings dropdown
   * on the current item detail page.
   */
  async openAddToPlaylistDialog() {
    const menuItem = this.page.getByTestId("menu-add-to-playlist");
    // Retry clicking Settings until the dropdown opens (handles hydration delay)
    await expect(async () => {
      await this.page.getByTestId("detail-settings-button").click();
      await expect(menuItem).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: Timeouts.api });
    // Click "Add to Playlist" menu item
    await menuItem.click();
    // Wait for the dialog to open
    await expect(this.page.getByTestId("dialog-add-to-playlist")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Create a new playlist from within the "Add to Playlist" dialog.
   * Uses the "Create New Playlist" or "Create your first playlist" button.
   *
   * @param name - Name for the new playlist
   */
  async createPlaylistFromDialog(name: string) {
    // Click either "create first" or "create new" depending on state
    const createFirst = this.page.getByTestId("create-first-playlist");
    const createNew = this.page.getByTestId("create-new-playlist");
    const target = createFirst.or(createNew);
    await target.click();

    // Fill the name in the create dialog
    await expect(this.page.getByTestId("dialog-create-playlist")).toBeVisible({
      timeout: Timeouts.animation,
    });
    await this.page.getByTestId("create-playlist-name-input").fill(name);
    await this.page.getByTestId("create-playlist-submit").click();

    // Wait for create dialog to close and playlist to appear in list
    await expect(
      this.page.getByTestId("dialog-create-playlist")
    ).not.toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Open the create playlist dialog from the playlists tab.
   * Clicks the "Create Playlist" or "New Playlist" button.
   */
  async openCreatePlaylistDialog() {
    const createButton = this.page.getByRole("button", {
      name: /create.*playlist|new.*playlist/i,
    });
    await createButton.click();
    await expect(this.page.getByTestId("dialog-create-playlist")).toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  /**
   * Create a playlist with visibility and pre-selected items.
   * Uses the enhanced create dialog directly (not from Add to Playlist).
   *
   * @param name - Playlist name
   * @param options - Optional visibility and items
   */
  async createPlaylistWithOptions(
    name: string,
    options?: {
      visibility?: "private" | "unlisted" | "public";
      itemNames?: string[];
    }
  ) {
    // Fill the name
    await expect(this.page.getByTestId("dialog-create-playlist")).toBeVisible({
      timeout: Timeouts.animation,
    });
    await this.page.getByTestId("create-playlist-name-input").fill(name);

    // Set visibility if specified — click the visible label wrapper,
    // not the sr-only RadioGroupItem (Playwright can't click hidden elements)
    if (options?.visibility) {
      await this.page
        .getByTestId("dialog-create-playlist")
        .locator("label", {
          has: this.page.getByRole("radio", {
            name: new RegExp(options.visibility, "i"),
          }),
        })
        .click();
    }

    // Select items if specified
    if (options?.itemNames) {
      for (const itemName of options.itemNames) {
        await this.page
          .getByTestId("dialog-create-playlist")
          .getByText(itemName)
          .click();
      }
    }

    await this.page.getByTestId("create-playlist-submit").click();

    await expect(
      this.page.getByTestId("dialog-create-playlist")
    ).not.toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Toggle a playlist checkbox in the "Add to Playlist" dialog.
   *
   * @param playlistName - The visible name of the playlist to toggle
   */
  async togglePlaylistCheckbox(playlistName: string) {
    const listItem = this.page
      .getByTestId("playlist-list")
      .getByText(playlistName);
    await listItem.click();
  }

  /** Close the "Add to Playlist" dialog via Escape or clicking outside. */
  async closeAddToPlaylistDialog() {
    await this.page.keyboard.press("Escape");
    await expect(
      this.page.getByTestId("dialog-add-to-playlist")
    ).not.toBeVisible({ timeout: Timeouts.animation });
  }

  // ── Playlist Section on Profile ─────────────────────────

  /** Expect the playlist section to be visible on the profile page. */
  async expectPlaylistSectionVisible() {
    await expect(this.page.getByTestId("playlist-section")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Expect the playlist section to not be visible. */
  async expectPlaylistSectionNotVisible() {
    await expect(this.page.getByTestId("playlist-section")).not.toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Expect a playlist card with the given name to be visible.
   *
   * @param name - The playlist name to look for
   */
  async expectPlaylistCardVisible(name: string) {
    // CardShell renders the name twice (default + hover overlay), use .first()
    await expect(
      this.page.getByTestId("playlist-section").getByText(name).first()
    ).toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Expect a playlist card with the given name to not be visible.
   *
   * @param name - The playlist name that should not appear
   */
  async expectPlaylistCardNotVisible(name: string) {
    // CardShell renders the name twice (default + hover overlay), use .first()
    await expect(
      this.page.getByTestId("playlist-section").getByText(name).first()
    ).not.toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Click a playlist card to navigate to its detail page.
   * Uses .first() because CardShell renders the name in both default and
   * overlay views — even though the overlay is aria-hidden, Playwright
   * may resolve multiple link matches via text content.
   *
   * @param name - The playlist name to click
   */
  async clickPlaylistCard(name: string) {
    const link = this.page
      .getByTestId("playlist-section")
      .getByRole("link", { name })
      .first();
    // Wait for the playlist card to be visible before clicking
    await expect(link).toBeVisible({ timeout: Timeouts.api });
    await link.click();
    // Wait for playlist detail page to load (URL changes to /playlists/)
    await this.page.waitForURL(/\/playlists\//, {
      timeout: Timeouts.navigation,
    });
    await expect(this.page.getByTestId("playlist-detail")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Playlist Detail Page ────────────────────────────────

  /** Expect the hero carousel on the playlist detail page. */
  async expectDetailHeroVisible() {
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  /**
   * Expect the playlist name to appear in the hero.
   *
   * @param name - The expected playlist name
   */
  async expectDetailName(name: string) {
    await expect(
      this.page.getByTestId("hero-carousel").getByText(name)
    ).toBeVisible({ timeout: Timeouts.api });
  }

  /**
   * Expect an item to be visible in the playlist detail grid.
   *
   * @param itemName - The item name to look for
   */
  async expectDetailItemVisible(itemName: string) {
    await expect(this.page.getByRole("button", { name: itemName })).toBeVisible(
      { timeout: Timeouts.api }
    );
  }

  /**
   * Expect an item to not be visible in the playlist detail grid.
   *
   * @param itemName - The item name that should not appear
   */
  async expectDetailItemNotVisible(itemName: string) {
    await expect(
      this.page.getByRole("button", { name: itemName })
    ).not.toBeVisible({ timeout: Timeouts.api });
  }

  /** Delete playlist via the settings gear menu on the detail hero. */
  async deletePlaylistFromDetail() {
    const deleteItem = this.page.getByTestId("menu-delete-playlist");
    // Retry clicking Settings until the dropdown opens (handles hydration delay)
    await expect(async () => {
      await this.page.getByTestId("playlist-settings-button").click();
      await expect(deleteItem).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: Timeouts.api });
    // Click the Delete menu item
    await deleteItem.click();
    // Confirm deletion in the alert dialog
    const confirmButton = this.page.getByRole("button", { name: /delete/i });
    await confirmButton.waitFor({
      state: "visible",
      timeout: Timeouts.animation,
    });
    await confirmButton.click();
  }

  /** Click the Share button on the playlist detail hero. */
  async sharePlaylistFromDetail() {
    await this.page.getByRole("button", { name: /share/i }).click();
  }

  // ── Toast Assertions ────────────────────────────────────

  /**
   * Expect a toast with the given text to appear.
   *
   * @param text - Text to look for in the toast
   */
  async expectToast(text: string | RegExp) {
    await expect(this.page.getByRole("status").getByText(text)).toBeVisible({
      timeout: Timeouts.api,
    });
  }
}
