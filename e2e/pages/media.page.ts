/**
 * Page object for media playback and item detail hero interactions.
 * Covers navigation to item detail, media player controls,
 * hero metadata assertions, and file tab switching.
 */
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { Timeouts } from "../config/timeouts";

export class MediaPage {
  constructor(
    private page: Page,
    private username: string,
    private isMobile: boolean
  ) {}

  // ── Navigation ────────────────────────────────────────

  /**
   * Navigate directly to a public item detail page by item ID.
   * Waits for the page to finish loading before returning.
   *
   * @param itemId - The unique identifier of the item
   */
  async goto(itemId: string) {
    await this.page.goto(`/u/${this.username}/${itemId}`);
    await this.page.waitForLoadState("domcontentloaded");
  }

  // ── Player Assertions ────────────────────────────────

  /**
   * Assert that the media player element is visible on the page.
   * Looks for the Vidstack media-player custom element.
   */
  async expectPlayerVisible() {
    await expect(this.page.getByTestId("media-player")).toBeVisible({
      timeout: Timeouts.api,
    });
  }

  /**
   * Assert that the hero section with runtime/metadata stats is visible.
   * Checks for the hero carousel element which contains metadata overlays.
   */
  async expectHeroStatsVisible() {
    await expect(this.page.getByTestId("hero-carousel")).toBeVisible({
      timeout: Timeouts.navigation,
    });
  }

  // ── Player Controls ───────────────────────────────────

  /**
   * Click the play button on the media player.
   * Waits for the button to be visible before clicking.
   */
  async play() {
    const playButton = this.page.getByTestId("media-play-button");
    await playButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await playButton.click();
  }

  /**
   * Click the pause button on the media player.
   * Waits for the button to be visible before clicking.
   */
  async pause() {
    const pauseButton = this.page.getByTestId("media-pause-button");
    await pauseButton.waitFor({ state: "visible", timeout: Timeouts.api });
    await pauseButton.click();
  }

  /**
   * Assert that the playback progress approximately matches the expected value.
   * Uses a tolerance of +/- 5% to account for timing variations.
   *
   * @param percent - The expected progress percentage (0-100)
   */
  async expectProgress(percent: number) {
    const progressBar = this.page.getByTestId("media-progress");
    await progressBar.waitFor({ state: "visible", timeout: Timeouts.api });

    const value = await progressBar.getAttribute("aria-valuenow");
    const actual = Number(value ?? 0);
    expect(actual).toBeGreaterThanOrEqual(percent - 5);
    expect(actual).toBeLessThanOrEqual(percent + 5);
  }

  // ── File Tabs ─────────────────────────────────────────

  /**
   * Switch to a different file tab when multiple files are available.
   * Clicks the tab matching the provided name within the media overlay.
   *
   * @param tabName - The label of the file tab to activate
   */
  async openFileTab(tabName: string) {
    const tab = this.page.getByTestId(`media-file-tab-${tabName}`);
    await tab.waitFor({ state: "visible", timeout: Timeouts.api });
    await tab.click();
  }
}
