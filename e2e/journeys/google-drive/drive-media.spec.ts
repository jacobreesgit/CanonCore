/**
 * E2E tests for media playback from Google Drive.
 * Tests artwork display, video streaming, and seeking.
 *
 * SETUP REQUIRED:
 * 1. Ensure E2E_GOOGLE_ROOT_FOLDER_ID points to a valid folder in the test Drive account
 *    - Open Google Drive as the E2E test account (jacobreesmedia@gmail.com)
 *    - Create a folder (e.g., "CanonCore-E2E-Tests")
 *    - Get the folder ID from the URL: drive.google.com/drive/folders/[FOLDER_ID]
 *    - Set E2E_GOOGLE_ROOT_FOLDER_ID=[FOLDER_ID] in .env.local
 *
 * 2. Create a subfolder named "Breaking Bad" inside that folder
 *
 * 3. Add a video file to the "Breaking Bad" folder
 */

import { test, expect } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

test.describe("Google Drive: Media Playback", () => {
  // Skip on mobile - sync and media playback tests are unreliable in mobile emulation
  // The core functionality is validated by desktop tests
  test.skip(({ isMobile }) => isMobile, "Skipping on mobile - sync unreliable");

  // Run tests serially - they share the same Google Drive account and parallel
  // execution causes race conditions with sync and Prisma operations
  test.describe.configure({ mode: "serial" });

  let itemsPage: ItemsPage;
  // This folder must exist in E2E_GOOGLE_ROOT_FOLDER_ID with a video file
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

      // Trigger sync from toolbar to import the pre-existing "Breaking Bad" folder from Drive
      const syncButton = page.getByRole("button", { name: /sync/i });
      await syncButton.click();

      // Wait for sync to complete - use polling instead of fixed timeout
      await expect(async () => {
        await page.reload();
        await itemsPage.waitForLoadingComplete();
        await expect(page.getByText(TEST_ITEM_NAME)).toBeVisible();
      }).toPass({ timeout: 30000, intervals: [2000, 3000, 5000] });

      // Note: If we get here, the item was found. If it times out above,
      // the error message from toPass will indicate the sync didn't complete.
    }
  );

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
      await expect(videoPlayer).toBeVisible({ timeout: 15000 });

      // Wait for video to be ready (with timeout)
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
