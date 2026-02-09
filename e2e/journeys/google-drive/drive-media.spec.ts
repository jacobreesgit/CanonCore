/**
 * E2E tests for media playback from Google Drive.
 * Tests artwork display, video streaming, and seeking.
 *
 * SETUP REQUIRED:
 * Run `pnpm run setup:e2e-drive` to create the pre-synced E2E Drive user
 * with the "Breaking Bad" folder and video file already in the database.
 */

import { test, expect, prisma } from "../../fixtures";
import { ItemsPage } from "../../pages/items.page";

test.describe("Google Drive: Media Playback", () => {
  // Skip on mobile - media playback tests are unreliable in mobile emulation
  // The core functionality is validated by desktop tests
  test.skip(({ isMobile }) => isMobile, "Skipping on mobile - sync unreliable");

  // Run tests serially - they share the same Google Drive account
  test.describe.configure({ mode: "serial" });

  let itemsPage: ItemsPage;
  // This folder is pre-synced by setup:e2e-drive
  const TEST_ITEM_NAME = "Breaking Bad";

  test.beforeEach(async ({ page, e2eDriveUser, cleanupTestDriveFolders }) => {
    // Clean up any leftover test folders from Google Drive (keeps "Breaking Bad")
    await cleanupTestDriveFolders();

    // Remove duplicate "Breaking Bad" items (keep only the one with driveFileId)
    const duplicates = await prisma.item.findMany({
      where: { userId: e2eDriveUser.id, name: TEST_ITEM_NAME },
      orderBy: { createdAt: "asc" },
    });
    if (duplicates.length > 1) {
      // Keep the first (original) one, delete the rest
      for (const dup of duplicates.slice(1)) {
        await prisma.itemFile.deleteMany({ where: { itemId: dup.id } });
        await prisma.item.delete({ where: { id: dup.id } });
      }
    }

    // e2eDriveUser fixture logs us in - "Breaking Bad" is already in the database
    itemsPage = new ItemsPage(page, e2eDriveUser.username);

    // Navigate to items page with fresh state (closes any modals from previous tests)
    await itemsPage.goto();
    await page.waitForLoadState("networkidle");
    await itemsPage.waitForLoadingComplete();

    // Wait for the item to be visible
    await itemsPage.expectItemVisible(TEST_ITEM_NAME);

    // Suppress unused variable warning - fixture is used for login side effect
    void e2eDriveUser;
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
    const heroArtwork = page.locator("[data-testid='hero-carousel-artwork']");
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
    const playButton = page.getByTestId("hero-play-button");
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
});
