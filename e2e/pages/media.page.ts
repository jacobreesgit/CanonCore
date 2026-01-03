/**
 * Page object for media detail view and playback.
 * Provides helpers for verifying file listings and media player interactions.
 */

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

export class MediaPage {
  readonly page: Page;
  readonly heroSection: Locator;
  readonly heroTitle: Locator;
  readonly mediaSection: Locator;
  readonly artworkSection: Locator;
  readonly subtitlesSection: Locator;
  readonly emptyState: Locator;
  readonly mediaOverlay: Locator;
  readonly videoPlayer: Locator;
  readonly closeOverlayButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Hero section with artwork
    this.heroSection = page.locator(".relative.overflow-hidden.rounded-xl");
    this.heroTitle = page.getByRole("heading", { level: 1 });
    // File sections - use data-slot="card" attribute from shadcn Card
    this.mediaSection = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Media Files" });
    this.artworkSection = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Artwork" });
    this.subtitlesSection = page
      .locator('[data-slot="card"]')
      .filter({ hasText: "Subtitles" });
    this.emptyState = page.getByText("No files attached");
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
    await this.page.goto(`/dashboard/${itemId}`);
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
    await this.page.goto(`/dashboard/connections/${connectionId}/${itemId}`);
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
   * Gets a media file row by filename.
   *
   * @param filename - The filename to find
   * @returns Locator for the file row
   */
  getMediaFileRow(filename: string): Locator {
    return this.mediaSection.locator("li").filter({ hasText: filename });
  }

  /**
   * Gets a subtitle file row by filename.
   *
   * @param filename - The filename to find
   * @returns Locator for the file row
   */
  getSubtitleRow(filename: string): Locator {
    return this.subtitlesSection.locator("li").filter({ hasText: filename });
  }

  /**
   * Expects a media file to be visible with the given filename.
   *
   * @param filename - The filename to check
   */
  async expectMediaFile(filename: string): Promise<void> {
    await expect(this.mediaSection).toBeVisible({ timeout: 10000 });
    await expect(this.getMediaFileRow(filename)).toBeVisible();
  }

  /**
   * Expects the media section to show a count of files.
   *
   * @param count - Expected file count
   */
  async expectMediaFileCount(count: number): Promise<void> {
    await expect(this.mediaSection).toBeVisible({ timeout: 10000 });
    const rows = this.mediaSection.locator("li");
    await expect(rows).toHaveCount(count);
  }

  /**
   * Expects artwork images to be visible.
   *
   * @param count - Expected artwork count
   */
  async expectArtworkCount(count: number): Promise<void> {
    await expect(this.artworkSection).toBeVisible({ timeout: 10000 });
    const images = this.artworkSection.locator("img");
    await expect(images).toHaveCount(count);
  }

  /**
   * Expects a subtitle file to be visible.
   *
   * @param filename - The filename to check
   */
  async expectSubtitleFile(filename: string): Promise<void> {
    await expect(this.subtitlesSection).toBeVisible({ timeout: 10000 });
    await expect(this.getSubtitleRow(filename)).toBeVisible();
  }

  /**
   * Expects the subtitle section to show a count of files.
   *
   * @param count - Expected subtitle count
   */
  async expectSubtitleCount(count: number): Promise<void> {
    await expect(this.subtitlesSection).toBeVisible({ timeout: 10000 });
    const rows = this.subtitlesSection.locator("li");
    await expect(rows).toHaveCount(count);
  }

  /**
   * Clicks the play button for a media file.
   *
   * @param filename - The filename to play
   */
  async clickPlayButton(filename: string): Promise<void> {
    const row = this.getMediaFileRow(filename);
    const playButton = row.getByRole("button", { name: /play|resume/i });
    await playButton.click();
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
   * Gets the download link for a media file.
   *
   * @param filename - The filename to get download link for
   * @returns Locator for the download link
   */
  getDownloadLink(filename: string): Locator {
    const row = this.getMediaFileRow(filename);
    return row.getByRole("link", { name: /download/i });
  }

  /**
   * Expects a progress badge showing watch percentage.
   *
   * @param filename - The media filename
   * @param percentage - Expected percentage (approximate)
   */
  async expectWatchProgress(
    filename: string,
    percentage: number
  ): Promise<void> {
    const row = this.getMediaFileRow(filename);
    const progressBadge = row.getByText(new RegExp(`${percentage}% watched`));
    await expect(progressBadge).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects the empty state to be visible.
   */
  async expectEmptyState(): Promise<void> {
    await expect(this.emptyState).toBeVisible({ timeout: 10000 });
  }

  /**
   * Expects tabs for both media and folders.
   */
  async expectTabsVisible(): Promise<void> {
    await expect(this.page.getByRole("tab", { name: /media/i })).toBeVisible();
    await expect(
      this.page.getByRole("tab", { name: /subfolders/i })
    ).toBeVisible();
  }

  /**
   * Clicks the Media tab.
   */
  async clickMediaTab(): Promise<void> {
    await this.page.getByRole("tab", { name: /media/i }).click();
  }

  /**
   * Clicks the Subfolders tab.
   */
  async clickSubfoldersTab(): Promise<void> {
    await this.page.getByRole("tab", { name: /subfolders/i }).click();
  }
}
