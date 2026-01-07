/**
 * Page object for media detail view and playback.
 * Provides helpers for verifying hero stats and media player interactions.
 * File cards removed - now only hero shows file stats.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class MediaPage {
  readonly page: Page;
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly heroStats: Locator;
  readonly emptyState: Locator;
  readonly mediaOverlay: Locator;
  readonly videoPlayer: Locator;
  readonly closeOverlayButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Hero section with artwork (uses data-testid from ItemHero)
    this.heroSection = page.getByTestId("item-hero");
    this.heroTitle = page.getByRole("heading", { level: 1 });
    // Hero stats row showing file counts (uses data-testid for resilience)
    this.heroStats = page.getByTestId("item-hero-stats");
    this.emptyState = page.getByText("No items yet");
    // Media overlay components
    this.mediaOverlay = page.getByRole("dialog");
    this.videoPlayer = page.locator("video");
    this.closeOverlayButton = page.getByRole("button", {
      name: "Close player",
    });
  }

  /**
   * Navigates to an item detail page.
   *
   * @param itemId - The item ID to view
   */
  async gotoItem(itemId: string): Promise<void> {
    await this.page.goto(`/my-items/${itemId}`);
  }

  /**
   * Navigates to a connection item detail page.
   *
   * @param connectionId - The connection ID
   * @param itemId - The item ID to view
   */
  async gotoConnectionItem(
    connectionId: string,
    itemId: string
  ): Promise<void> {
    await this.page.goto(`/my-items/connections/${connectionId}/${itemId}`);
  }

  /**
   * Expects the hero section to be visible with the given title.
   *
   * @param title - Expected item title
   */
  async expectHeroWithTitle(title: string): Promise<void> {
    await expect(this.heroTitle).toBeVisible({ timeout: 10000 });
    await expect(this.heroTitle).toHaveText(title);
  }

  /**
   * Expects hero stats to show media file count.
   *
   * @param count - Expected media file count
   */
  async expectHeroMediaCount(count: number): Promise<void> {
    await expect(this.heroSection).toBeVisible({ timeout: 10000 });
    const mediaText = count === 1 ? "1 media file" : `${count} media files`;
    await expect(this.heroSection.getByText(mediaText)).toBeVisible();
  }

  /**
   * Expects hero stats to show artwork count.
   *
   * @param count - Expected artwork count
   */
  async expectHeroArtworkCount(count: number): Promise<void> {
    await expect(this.heroSection).toBeVisible({ timeout: 10000 });
    await expect(this.heroSection.getByText(`${count} artwork`)).toBeVisible();
  }

  /**
   * Expects hero stats to show subtitle count.
   *
   * @param count - Expected subtitle count
   */
  async expectHeroSubtitleCount(count: number): Promise<void> {
    await expect(this.heroSection).toBeVisible({ timeout: 10000 });
    const subtitleText = count === 1 ? "1 subtitle" : `${count} subtitles`;
    await expect(this.heroSection.getByText(subtitleText)).toBeVisible();
  }

  /**
   * Expects hero stats to show item count.
   *
   * @param count - Expected item count
   */
  async expectHeroItemCount(count: number): Promise<void> {
    await expect(this.heroSection).toBeVisible({ timeout: 10000 });
    const itemText = count === 1 ? "1 item" : `${count} items`;
    await expect(this.heroSection.getByText(itemText)).toBeVisible();
  }

  /**
   * Clicks the play button in the hero section.
   * Now the only way to play media (no file card play buttons).
   */
  async clickPlayButton(): Promise<void> {
    await this.clickHeroPlayButton();
  }

  /**
   * Expects the media overlay to be visible.
   */
  async expectMediaOverlayVisible(): Promise<void> {
    await expect(this.mediaOverlay).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects the media overlay to not be visible.
   */
  async expectMediaOverlayNotVisible(): Promise<void> {
    await expect(this.mediaOverlay).not.toBeVisible();
  }

  /**
   * Closes the media overlay.
   */
  async closeMediaOverlay(): Promise<void> {
    // Try close button first (with exact aria-label), then escape key
    const closeButton = this.page.getByRole("button", { name: "Close player" });
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      await this.page.keyboard.press("Escape");
    }
    await this.expectMediaOverlayNotVisible();
  }

  /**
   * Expects the empty state to be visible.
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects the hero section to be visible.
   */
  async expectHeroVisible(): Promise<void> {
    await expect(this.heroSection).toBeVisible({ timeout: 10000 });
  }

  /**
   * Clicks the play button in the hero.
   */
  async clickHeroPlayButton(): Promise<void> {
    const playButton = this.heroSection.getByRole("button", {
      name: /play|resume/i,
    });
    await playButton.click();
  }
}
