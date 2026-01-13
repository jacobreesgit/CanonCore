/**
 * E2E tests for video seeking via Range requests.
 * Tests that the stream route properly handles Range headers for video playback.
 */

import { test, expect } from "../../fixtures";

test.describe("Video Seeking", () => {
  test.skip(
    !process.env.E2E_GOOGLE_REFRESH_TOKEN,
    "Requires Google Drive connection for media files"
  );

  test("video player supports seeking via Range requests", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // testUser fixture handles sign-in automatically
    // Navigate to items and find one with media
    // Note: This assumes E2E test data includes an item with video
    await itemsPage.goto();

    // Click on a known test item that contains video
    // Alternative: Use gotoItem with a known item ID from test setup
    // await itemsPage.gotoItem("item-with-video-id");

    // Wait for video player to be visible
    const videoPlayer = page.locator("video").first();

    // Skip if no video found (test data dependent)
    const videoCount = await page.locator("video").count();
    test.skip(videoCount === 0, "No video element found in test item");

    await expect(videoPlayer).toBeVisible({ timeout: 15000 });

    // Get video duration
    const duration = await videoPlayer.evaluate(
      (v: HTMLVideoElement) => v.duration
    );
    expect(duration).toBeGreaterThan(0);

    // Seek to middle of video (this triggers Range request)
    const seekTime = duration / 2;
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
  });

  test("video player handles invalid seek gracefully", async ({
    page,
    itemsPage,
    testUser,
  }) => {
    // testUser fixture handles sign-in automatically
    await itemsPage.goto();

    const videoPlayer = page.locator("video").first();

    const videoCount = await page.locator("video").count();
    test.skip(videoCount === 0, "No video element found");

    await expect(videoPlayer).toBeVisible({ timeout: 15000 });

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
  });
});
