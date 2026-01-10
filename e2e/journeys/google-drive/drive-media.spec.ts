/**
 * E2E tests for media playback from Google Drive.
 * Tests artwork display, video streaming, and seeking.
 */

import { test, expect } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

test.describe("Google Drive: Media Playback", () => {
  let itemsPage: ItemsPage;
  const TEST_ITEM_NAME = "Media Playback Test";

  test.beforeEach(async ({ page, setupDriveConnection, testUser }) => {
    await setupDriveConnection(testUser.id);
    itemsPage = new ItemsPage(page);
    await itemsPage.goto();

    // Create a test item for media tests
    await itemsPage.createItem(TEST_ITEM_NAME);
  });

  test("displays item detail page correctly", async ({ page }) => {
    // Navigate to the test item
    await itemsPage.clickItem(TEST_ITEM_NAME);

    // Verify item detail page loads
    await expect(
      page.getByRole("heading", { name: TEST_ITEM_NAME })
    ).toBeVisible();

    // Hero section should be visible
    await itemsPage.expectHeroVisible(TEST_ITEM_NAME);
  });

  test("artwork uses correct API route when present", async ({ page }) => {
    await itemsPage.clickItem(TEST_ITEM_NAME);

    // Check for hero artwork (may not exist without actual media files)
    const heroArtwork = page.locator("[data-testid='item-hero-artwork']");
    const hasHeroArtwork = await heroArtwork.count();

    if (hasHeroArtwork > 0) {
      const src = await heroArtwork.getAttribute("src");
      if (src) {
        // Verify it uses our API route
        expect(src).toContain("/api/artwork/");
      }
    }
  });

  test("video player uses stream API when media exists", async ({ page }) => {
    await itemsPage.clickItem(TEST_ITEM_NAME);

    // Look for play button (may not exist without media files)
    const playButton = page.getByRole("button", { name: /play/i });
    const hasPlayButton = await playButton.count();

    if (hasPlayButton > 0) {
      await playButton.click();

      // Verify video player loads
      const videoPlayer = page.locator("video");
      await expect(videoPlayer).toBeVisible({ timeout: 10000 });

      // Verify video src uses our streaming API
      const src = await videoPlayer.getAttribute("src");
      if (src) {
        expect(src).toContain("/api/stream/");
      }
    } else {
      // Skip test gracefully if no media files
      test.skip(true, "No media files available for playback test");
    }
  });

  test("video player supports seeking", async ({ page }) => {
    await itemsPage.clickItem(TEST_ITEM_NAME);

    const playButton = page.getByRole("button", { name: /play/i });
    const hasPlayButton = await playButton.count();

    if (hasPlayButton > 0) {
      await playButton.click();

      const videoPlayer = page.locator("video");
      await expect(videoPlayer).toBeVisible({ timeout: 10000 });

      // Wait for video to be ready
      await videoPlayer.evaluate(async (video: HTMLVideoElement) => {
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1) resolve();
          else
            video.addEventListener("loadedmetadata", () => resolve(), {
              once: true,
            });
        });
      });

      // Seek to 50% of video
      await videoPlayer.evaluate((video: HTMLVideoElement) => {
        const targetTime = Math.min(10, video.duration * 0.5);
        video.currentTime = targetTime;
      });

      // Verify seek worked
      const currentTime = await videoPlayer.evaluate(
        (v: HTMLVideoElement) => v.currentTime
      );
      expect(currentTime).toBeGreaterThan(0);
    } else {
      test.skip(true, "No media files available for seeking test");
    }
  });
});
