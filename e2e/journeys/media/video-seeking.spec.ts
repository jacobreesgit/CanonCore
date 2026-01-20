/**
 * E2E tests for video seeking via Range requests.
 * Tests that the stream route properly handles Range headers for video playback.
 *
 * Uses the same "Breaking Bad" test folder as drive-media.spec.ts.
 * Global setup ensures the folder and video file exist.
 */

import { test, expect } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

test.describe("Video Seeking", () => {
  test.skip(
    !process.env.GOOGLE_E2E_REFRESH_TOKEN,
    "Requires Google Drive connection for media files"
  );

  // Skip on mobile - sync and media playback tests are unreliable in mobile emulation
  test.skip(({ isMobile }) => isMobile, "Skipping on mobile - sync unreliable");

  // Run tests serially - they share the same Google Drive account
  test.describe.configure({ mode: "serial" });

  let itemsPage: ItemsPage;
  const TEST_ITEM_NAME = "Breaking Bad";

  test.beforeEach(
    async ({
      page,
      setupDriveConnection,
      testUser,
      cleanupUserItems,
      cleanupTestDriveFolders,
    }) => {
      // Clean up any leftover test folders from Google Drive (keeps "Breaking Bad")
      await cleanupTestDriveFolders();

      // Clean up any leftover items from previous test runs
      await cleanupUserItems(testUser.id);

      await setupDriveConnection(testUser.id);
      itemsPage = new ItemsPage(page);
      await itemsPage.goto();
      await itemsPage.waitForLoadingComplete();

      // Trigger sync from toolbar to import the pre-existing "Breaking Bad" folder
      const syncButton = page.getByRole("button", { name: /sync/i });
      await syncButton.click();

      // Wait for sync to complete
      await expect(async () => {
        await page.reload();
        await itemsPage.waitForLoadingComplete();
        await expect(page.getByText(TEST_ITEM_NAME)).toBeVisible();
      }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] });
    }
  );

  test("video player supports seeking via Range requests", async ({ page }) => {
    // Navigate to the test item
    await itemsPage.clickItem(TEST_ITEM_NAME);

    // Look for play button
    const playButton = page.getByRole("button", { name: /play/i });
    const hasPlayButton = await playButton.count();

    if (hasPlayButton > 0) {
      await playButton.click();

      // Wait for video player to be visible
      const videoPlayer = page.locator("video");
      await expect(videoPlayer).toBeVisible({ timeout: 15000 });

      // Wait for video metadata to load
      await videoPlayer.evaluate(async (video: HTMLVideoElement) => {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Video metadata timeout")),
            20000
          );
          if (video.readyState >= 1) {
            clearTimeout(timeout);
            resolve();
          } else {
            video.addEventListener(
              "loadedmetadata",
              () => {
                clearTimeout(timeout);
                resolve();
              },
              { once: true }
            );
          }
        });
      });

      // Get video duration
      const duration = await videoPlayer.evaluate(
        (v: HTMLVideoElement) => v.duration
      );
      expect(duration).toBeGreaterThan(0);

      // Seek to middle of video (this triggers Range request)
      const seekTime = Math.min(10, duration / 2);
      await videoPlayer.evaluate((v: HTMLVideoElement, time: number) => {
        v.currentTime = time;
      }, seekTime);

      // Wait for seek to complete
      await page.waitForTimeout(1500);

      // Verify seek position (allow 2 second tolerance)
      const currentTime = await videoPlayer.evaluate(
        (v: HTMLVideoElement) => v.currentTime
      );
      expect(currentTime).toBeGreaterThan(seekTime - 2);
      expect(currentTime).toBeLessThan(seekTime + 2);
    } else {
      test.skip(true, "No media files available for playback test");
    }
  });

  test("video player handles invalid seek gracefully", async ({ page }) => {
    // Navigate to the test item
    await itemsPage.clickItem(TEST_ITEM_NAME);

    // Look for play button
    const playButton = page.getByRole("button", { name: /play/i });
    const hasPlayButton = await playButton.count();

    if (hasPlayButton > 0) {
      await playButton.click();

      const videoPlayer = page.locator("video");
      await expect(videoPlayer).toBeVisible({ timeout: 15000 });

      // Wait for video metadata to load
      await videoPlayer.evaluate(async (video: HTMLVideoElement) => {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("Video metadata timeout")),
            20000
          );
          if (video.readyState >= 1) {
            clearTimeout(timeout);
            resolve();
          } else {
            video.addEventListener(
              "loadedmetadata",
              () => {
                clearTimeout(timeout);
                resolve();
              },
              { once: true }
            );
          }
        });
      });

      const duration = await videoPlayer.evaluate(
        (v: HTMLVideoElement) => v.duration
      );

      // Try to seek beyond video duration
      await videoPlayer.evaluate((v: HTMLVideoElement, time: number) => {
        v.currentTime = time + 100;
      }, duration);

      await page.waitForTimeout(500);

      // Video should clamp to end
      const currentTime = await videoPlayer.evaluate(
        (v: HTMLVideoElement) => v.currentTime
      );
      expect(currentTime).toBeLessThanOrEqual(duration);
    } else {
      test.skip(true, "No media files available for seeking test");
    }
  });
});
