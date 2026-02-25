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
   * Click the "Fork to Library" button on a public item detail page.
   * Retries click until React's onClick handler fires (hydration may be
   * delayed under heavy parallel load). The handler sets isForking=true
   * which disables the button — we use that as the hydration signal.
   */
  async forkItem() {
    const button = this.page.getByTestId("profile-fork-button");
    await expect(async () => {
      if ((await button.isVisible()) && (await button.isEnabled())) {
        await button.click();
      }
      // Handler fires → setIsForking(true) → button becomes disabled
      await expect(button).toBeDisabled({ timeout: 2_000 });
    }).toPass({ timeout: Timeouts.upload });
  }

  /** Expect the fork button to be visible. */
  async expectForkButtonVisible() {
    await expect(this.page.getByTestId("profile-fork-button")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /** Expect the fork button to not exist on the page. */
  async expectForkButtonNotVisible() {
    await expect(this.page.getByTestId("profile-fork-button")).not.toBeVisible({
      timeout: Timeouts.animation,
    });
  }
}
