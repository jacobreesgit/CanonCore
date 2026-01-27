/**
 * Portfolio screenshot automation.
 * Captures 35 screenshots for the portfolio/marketing site.
 *
 * Run with: npx playwright test --config=e2e/screenshots/playwright.config.ts
 */

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  USERS,
  setupForScreenshot,
  setTheme,
  switchToGridView,
  switchToTreeView,
  openSettings,
  waitForHero,
  openSpotlight,
  enterEditMode,
  clickItem,
  openContextMenu,
  deleteItem,
  openSortDropdown,
  selectFilter,
  captureScreenshot,
  SCREENSHOT_DIR,
} from "./utils";

// Configure for 1920x1080 desktop viewport
test.use({
  viewport: { width: 1920, height: 1080 },
});

// Run tests serially to maintain login state between related screenshots
test.describe.configure({ mode: "serial" });

test.describe("Portfolio Screenshots", () => {
  // Delete all existing screenshots (except 03-video-player.png) before running full suite
  // Only runs when CLEAN_SCREENSHOTS=true environment variable is set
  // This prevents deletion when running specific tests with --grep
  test.beforeAll(() => {
    if (process.env.CLEAN_SCREENSHOTS === "true") {
      if (fs.existsSync(SCREENSHOT_DIR)) {
        const files = fs.readdirSync(SCREENSHOT_DIR);
        let deletedCount = 0;
        for (const file of files) {
          // Skip 03-video-player.png since it's manually maintained
          if (file === "03-video-player.png") continue;
          if (file.endsWith(".png")) {
            fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
            deletedCount++;
          }
        }
        console.log(
          `🗑️  Deleted ${deletedCount} screenshots (preserving 03-video-player.png)`
        );
      }
    }
  });

  // Clear any open dialogs before each test for resilience
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("Escape").catch(() => {});
  });

  // =========================================================================
  // Main Feature Screenshots (1-9)
  // =========================================================================

  test.describe("Main Features", () => {
    test("01 - Library Grid View", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Root page defaults to grid view, no need to switch
      await waitForHero(page);
      await captureScreenshot(page, "01-library-grid");
    });

    test("02 - Tree View", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Navigate to Breaking Bad to see tree view with episodes
      await clickItem(page, "Breaking Bad (2008)");
      await switchToTreeView(page);
      await page.waitForTimeout(500); // Wait for tree to render

      // Collapse Seasons 1, 2, 3 using same pattern as items.page.ts
      for (const seasonNum of [1, 2, 3]) {
        const item = page
          .getByRole("listitem")
          .filter({ hasText: `Season ${seasonNum}` });
        const collapseButton = item.getByRole("button", {
          name: /collapse item/i,
        });
        if (await collapseButton.isVisible()) {
          await collapseButton.click();
          await page.waitForTimeout(200);
        }
      }

      // Expand Season 4
      const season4Item = page
        .getByRole("listitem")
        .filter({ hasText: "Season 4" });
      const expandButton = season4Item.getByRole("button", {
        name: /expand item/i,
      });
      if (await expandButton.isVisible()) {
        await expandButton.click();
        await page.waitForTimeout(300);
      }
      await captureScreenshot(page, "02-tree-view");
    });

    // SKIPPED: Manual screenshot used - video rendering in headless Chrome shows black frames
    test.skip("03 - Video Player", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Navigate to Breaking Bad > Season 1 > E01 - Pilot
      await clickItem(page, "Breaking Bad (2008)");
      await page.waitForLoadState("networkidle");
      await clickItem(page, "Season 1");
      await page.waitForLoadState("networkidle");

      // Click on E01 - Pilot card to open episode detail page
      const episodeCard = page.getByRole("button", { name: /E01 - Pilot/i });
      await episodeCard.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);

      // Look for Watch, Resume, or Play button
      const watchButton = page
        .getByRole("button", { name: /watch|resume|play/i })
        .first();
      const hasButton = await watchButton
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (hasButton) {
        await watchButton.click();

        // Wait for video to have enough data loaded and be ready to play
        await page
          .waitForFunction(
            () => {
              const video = document.querySelector("video");
              if (!video) return false;
              // Wait for HAVE_ENOUGH_DATA (readyState 4) and not seeking
              return video.readyState >= 4 && !video.seeking;
            },
            { timeout: 20000 }
          )
          .catch(() => console.log("Video did not reach ready state"));

        // Seek to 15 minutes (900 seconds) where there should be actual content
        await page.evaluate(() => {
          const video = document.querySelector("video");
          if (video) {
            video.currentTime = 900; // 15 minutes in
          }
        });
        // Wait for seek to complete and video to have frame data
        await page
          .waitForFunction(
            () => {
              const video = document.querySelector("video");
              return video && !video.seeking && video.readyState >= 2;
            },
            { timeout: 10000 }
          )
          .catch(() => {});

        // Play briefly to ensure frame is rendered, then pause
        await page.evaluate(() => {
          const video = document.querySelector("video");
          if (video) video.play();
        });
        await page.waitForTimeout(1000);
        await page.evaluate(() => {
          const video = document.querySelector("video");
          if (video) video.pause();
        });
        await page.waitForTimeout(300);
      }
      await captureScreenshot(page, "03-video-player");
    });

    test("04 - TMDB Wizard", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Open Add Item dialog
      const addButton = page.getByRole("button", { name: /add/i });
      await addButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      // Search for a movie
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill("Dune");
      await page.waitForTimeout(1000);
      // Select a result to get to step 2 (poster selection)
      const result = page.getByRole("option").first();
      if (await result.isVisible()) {
        await result.click();
        await page.waitForTimeout(500);
        // Click next to get to poster selection (use exact match to avoid Next.js Dev Tools button)
        const nextButton = page.getByRole("button", {
          name: "Next",
          exact: true,
        });
        if (await nextButton.isVisible()) {
          await nextButton.click();
          await page.waitForTimeout(1000);
        }
      }
      await captureScreenshot(page, "04-tmdb-wizard");
    });

    test("05 - Item Settings", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Navigate to Breaking Bad and open settings
      await clickItem(page, "Breaking Bad (2008)");
      await page.waitForLoadState("networkidle");

      // Click the Settings button
      const settingsButton = page.getByRole("button", { name: /settings/i });
      await settingsButton.click();
      await page.waitForTimeout(500);

      await captureScreenshot(page, "05-progress-tracking");
    });

    test("06 - Google Drive Sync", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await openSettings(page);
      // Navigate to Google Drive section (may be on Activity tab)
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();
      }
      await captureScreenshot(page, "06-google-drive-sync");
    });

    test("07 - Explore Page", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await page.goto("/explore");
      await waitForHero(page);

      // Wait for carousel to load
      await page.waitForTimeout(1000);

      // Navigate to Black Mirror slide (index 1)
      const dots = page.locator('button[aria-label^="Go to slide"]');
      await dots.nth(1).click();
      await page.waitForTimeout(1500);

      await captureScreenshot(page, "07-explore-page");
    });

    test("08 - Spotlight Search", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await openSpotlight(page);
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "08-spotlight-search");
    });

    test("09 - Edit Mode", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");

      // Navigate to Breaking Bad to show tree view with hierarchical structure
      await clickItem(page, "Breaking Bad (2008)");
      await switchToTreeView(page);
      await page.waitForTimeout(500);

      // Collapse Seasons 2, 3, 4, 5 (keep Season 1 expanded)
      for (const seasonNum of [2, 3, 4, 5]) {
        const item = page
          .getByRole("listitem")
          .filter({ hasText: `Season ${seasonNum}` });
        const collapseButton = item.getByRole("button", {
          name: /collapse item/i,
        });
        if (await collapseButton.isVisible()) {
          await collapseButton.click();
          await page.waitForTimeout(200);
        }
      }

      // Enter edit mode - Click the Edit button in toolbar
      const editButton = page.getByRole("button", { name: "Edit" });
      await editButton.click({ force: true });
      await page.waitForTimeout(1500); // Wait for edit mode UI to fully render

      // Select Season 1 checkbox to demonstrate cascading selection
      const season1Checkbox = page
        .getByRole("checkbox", { name: /select Season 1/i })
        .first();
      await season1Checkbox.click();
      await page.waitForTimeout(500);

      await captureScreenshot(page, "09-edit-mode");
    });
  });

  // =========================================================================
  // Different Users' Libraries (10-13)
  // =========================================================================

  test.describe("User Libraries", () => {
    test("10 - filmfan Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      // Root page defaults to grid view
      await waitForHero(page);
      await captureScreenshot(page, "10-filmfan-grid");
    });

    test("11 - bingewatcher Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.bingewatcher, "light");
      // Root page defaults to grid view
      await waitForHero(page);
      await captureScreenshot(page, "11-bingewatcher-grid");
    });

    test("12 - scifi_jordan Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      // Root page defaults to grid view
      await waitForHero(page);
      await captureScreenshot(page, "12-scifi-grid");
    });

    test("13 - scifi_jordan Tree (Doctor Who)", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      await clickItem(page, "Doctor Who");
      await switchToTreeView(page);
      await captureScreenshot(page, "13-scifi-tree");
    });
  });

  // =========================================================================
  // Dark Mode Variants (14-18)
  // =========================================================================

  test.describe("Dark Mode", () => {
    test("14 - Grid View (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      // Root page defaults to grid view
      await waitForHero(page);
      await captureScreenshot(page, "14-grid-dark");
    });

    test("15 - Tree View (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "dark");
      await clickItem(page, "Doctor Who");
      await switchToTreeView(page);
      await captureScreenshot(page, "15-tree-dark");
    });

    test("16 - Spotlight Search (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      await openSpotlight(page);
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "16-spotlight-dark");
    });

    test("17 - Public Profile (Dark)", async ({ page }) => {
      // View filmfan's profile as another user (shows visitor view with Fork buttons)
      await setupForScreenshot(page, USERS.demo, "dark");
      await page.goto("/u/filmfan");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000); // Wait for profile to load
      await captureScreenshot(page, "17-public-dark");
    });

    test("18 - Settings - Profile Tab (Dark)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "dark");
      await openSettings(page);
      // Profile tab is the default, no need to click
      await captureScreenshot(page, "18-settings-dark");
    });
  });

  // =========================================================================
  // Item Detail Pages (19-22)
  // =========================================================================

  test.describe("Item Details", () => {
    test("19 - Movie Detail - The Matrix", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await clickItem(page, "The Matrix (1999)");
      await waitForHero(page);
      await captureScreenshot(page, "19-matrix-detail");
    });

    test("20 - TV Show Detail - Game of Thrones", async ({ page }) => {
      await setupForScreenshot(page, USERS.bingewatcher, "light");
      await clickItem(page, "Game of Thrones (2011)");
      await waitForHero(page);
      await captureScreenshot(page, "20-got-detail");
    });

    test("21 - Episode Detail - Doctor Who", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      await clickItem(page, "Doctor Who");
      await clickItem(page, "Series 1");
      await clickItem(page, "E01 - Rose");
      await waitForHero(page);
      await captureScreenshot(page, "21-episode-detail");
    });

    test("22 - International Film - Spirited Away", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      await clickItem(page, "Spirited Away (2001)");
      await waitForHero(page);
      await captureScreenshot(page, "22-spirited-away-detail");
    });
  });

  // =========================================================================
  // UI States (23-27)
  // =========================================================================

  test.describe("UI States", () => {
    test("23 - Empty State", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Create a temporary empty folder
      const addButton = page.getByRole("button", { name: /add/i });
      await addButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      const nameInput = page.getByLabel(/name/i);
      await nameInput.fill("Empty Test Folder");
      const createButton = page.getByRole("button", { name: /create/i });
      await createButton.click();
      await page.waitForLoadState("networkidle");
      // Navigate into the empty folder
      await clickItem(page, "Empty Test Folder");
      await captureScreenshot(page, "23-empty-state");

      // Cleanup: delete the test folder
      await page.goto(`/u/${USERS.demo.username}`);
      await enterEditMode(page);
      await deleteItem(page, "Empty Test Folder");
    });

    test("24 - Bulk Selection", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Root page defaults to grid view and custom sort (edit mode available)

      // Enter edit mode - Click the Edit button in toolbar
      const editButton = page.getByRole("button", { name: "Edit" });
      await editButton.click({ force: true });
      await page.waitForTimeout(1500); // Wait for edit mode UI to fully render

      // Click "Select All" button in toolbar
      const selectAllButton = page.getByRole("button", { name: /select all/i });
      await selectAllButton.click();
      await page.waitForTimeout(500);

      await captureScreenshot(page, "24-bulk-selection");
    });

    test("25 - Context Menu", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Root page defaults to grid view
      await page.waitForLoadState("networkidle");

      // Get grid view and right-click on first item (top row)
      const gridView = page.locator('[data-testid="items-grid-view"]');
      await gridView.waitFor({ state: "visible" });

      const firstItem = gridView.locator("> div").first();
      await firstItem.click({ button: "right", position: { x: 100, y: 100 } });

      // Wait for context menu to be fully visible
      const contextMenu = page.locator('[role="menu"]');
      await contextMenu.waitFor({ state: "visible", timeout: 5000 });

      await page.waitForTimeout(500);
      await captureScreenshot(page, "25-context-menu");
    });

    test("26 - Filter Active", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      // Root page defaults to grid view
      await selectFilter(page, "Has Files");
      await captureScreenshot(page, "26-filter-active");
    });

    test("27 - Sort Dropdown", async ({ page }) => {
      await setupForScreenshot(page, USERS.bingewatcher, "light");
      // Root page defaults to grid view
      await openSortDropdown(page);
      await captureScreenshot(page, "27-sort-dropdown");
    });
  });

  // =========================================================================
  // Progress Variations (28-30)
  // =========================================================================

  test.describe("Progress Variations", () => {
    test("28 - Nearly Complete (~90%)", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan, "light");
      // filmfan has 80-100% progress range - navigate to a TV show to see aggregate progress
      await clickItem(page, "Squid Game (2021)");
      await waitForHero(page);
      await captureScreenshot(page, "28-progress-nearly-complete");
    });

    test("29 - Just Started (~20%)", async ({ page }) => {
      await setupForScreenshot(page, USERS.bingewatcher, "light");
      // bingewatcher has 10-95% range - navigate to a TV show to see aggregate progress
      await clickItem(page, "Stranger Things (2016)");
      await waitForHero(page);
      await captureScreenshot(page, "29-progress-just-started");
    });

    test("30 - Mid-Progress (~50%)", async ({ page }) => {
      await setupForScreenshot(page, USERS.scifi, "light");
      // scifi_jordan has 40-95% range - navigate to a TV show to see aggregate progress
      await clickItem(page, "Doctor Who");
      await waitForHero(page);
      await captureScreenshot(page, "30-progress-mid");
    });
  });

  // =========================================================================
  // Public/Social Features (31-33)
  // =========================================================================

  test.describe("Social Features", () => {
    test("31 - Public Profile", async ({ page }) => {
      // View filmfan's profile as another user (shows visitor view with Fork buttons)
      await setupForScreenshot(page, USERS.demo, "light");
      await page.goto("/u/filmfan");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000); // Wait for profile to load
      await captureScreenshot(page, "31-public-profile");
    });

    test("32 - Fork Dialog", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      // Go to explore page where fork buttons are visible
      await page.goto("/explore");
      await page.waitForLoadState("networkidle");

      // Wait for page to fully load
      await page.waitForTimeout(2000);

      // Scroll down to see grid items (carousel is at top)
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(500);

      // Find and click a Fork button on any grid item
      const forkButton = page.getByRole("button", { name: /fork/i }).first();
      await forkButton.waitFor({ state: "visible", timeout: 10000 });
      await forkButton.click();

      // Wait for the fork dialog to open
      await page.waitForSelector('[role="dialog"]', {
        state: "visible",
        timeout: 5000,
      });

      // Wait for dialog content to render
      await page.waitForTimeout(1500);

      // Take screenshot directly without waiting for all images (dialog may have many folder icons)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, "32-fork-dialog.png"),
        fullPage: false,
      });
    });

    test("33 - Settings - Connections Tab (Light)", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await openSettings(page);
      // Navigate to Connections tab
      await page.getByRole("tab", { name: /connections/i }).click();
      await captureScreenshot(page, "33-settings-connections");
    });
  });

  // =========================================================================
  // Hero Carousel States (34-35)
  // =========================================================================

  test.describe("Hero Carousel", () => {
    test("34 - Multi-slide Carousel", async ({ page }) => {
      await page.goto("/explore");
      await setTheme(page, "dark");
      await waitForHero(page);
      // Wait for carousel to potentially auto-advance
      await page.waitForLoadState("networkidle");
      await captureScreenshot(page, "34-multi-carousel");
    });

    test("35 - Single Hero Banner", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo, "light");
      await clickItem(page, "The Godfather (1972)");
      await waitForHero(page);
      await captureScreenshot(page, "35-single-hero");
    });
  });
});
