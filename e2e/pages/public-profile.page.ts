/**
 * Page object for public profile pages.
 * Covers viewing another user's profile, library visibility checks,
 * item interactions, and forking items to your library.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class PublicProfilePage {
  constructor(
    private page: Page,
    private isMobile: boolean
  ) {}

  // ── Navigation ──────────────────────────────────────────

  /**
   * Navigate to a user's public profile page.
   *
   * @param username - The username to visit
   */
  async goto(username: string) {
    await this.page.goto(`/u/${username}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  // ── Profile Assertions ─────────────────────────────────

  /**
   * Expect the profile page to be loaded and showing the given username.
   *
   * @param username - The username that should appear on the profile
   */
  async expectProfileVisible(username: string) {
    await expect(this.page).toHaveURL(new RegExp(`/u/${username}`), {
      timeout: Timeouts.navigation,
    });
    await this.page.waitForLoadState("domcontentloaded");
  }

  /** Expect the library section to be visible on the profile. */
  async expectLibraryVisible() {
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Item Assertions ─────────────────────────────────────

  /**
   * Expect an item with the given name to be visible in the library.
   *
   * @param name - The item name to look for
   */
  async expectItemVisible(name: string) {
    await expect(this.page.getByRole("link", { name })).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Expect an item with the given name to not be visible in the library.
   *
   * @param name - The item name that should not appear
   */
  async expectItemNotVisible(name: string) {
    await expect(this.page.getByRole("link", { name })).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }

  // ── Item Interaction ────────────────────────────────────

  /**
   * Click an item in the public library.
   *
   * @param name - The name of the item to click
   */
  async clickItem(name: string) {
    await this.page.getByRole("link", { name }).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  // ── Fork ────────────────────────────────────────────────

  /**
   * Fork a public item via the viewer settings dropdown menu.
   * Opens the gear menu, clicks "Fork to Library", and waits for
   * the fork to complete.
   */
  async forkItem() {
    const menuFork = this.page.getByTestId("menu-fork");
    // Retry clicking Settings until the dropdown opens (handles hydration delay)
    await expect(async () => {
      await this.page.getByTestId("viewer-detail-settings-button").click();
      await expect(menuFork).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: Timeouts.api });
    // Click Fork to Library
    await menuFork.click();
    // Wait for the fork API to complete — toast confirms success
    await expect(this.page.getByText("Added to your library!")).toBeVisible({
      timeout: Timeouts.heavy,
    });
  }

  /** Expect the viewer settings button to be visible (contains fork action). */
  async expectForkButtonVisible() {
    await expect(
      this.page.getByTestId("viewer-detail-settings-button")
    ).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Expect the fork option to not be available in the settings menu. */
  async expectForkButtonNotVisible() {
    // Open the settings menu to check Fork is gone
    await this.page.getByTestId("viewer-detail-settings-button").click();
    await expect(this.page.getByTestId("menu-fork")).not.toBeVisible({
      timeout: Timeouts.animation,
    });
    // Close the menu by pressing Escape
    await this.page.keyboard.press("Escape");
  }
}
