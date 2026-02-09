/**
 * Portfolio screenshot automation.
 * Captures screenshots for active portfolio images only.
 *
 * Run with: npx playwright test --config=e2e/screenshots/playwright.config.ts
 */

import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  USERS,
  setupForScreenshot,
  switchToTreeView,
  waitForHero,
  openSpotlight,
  openSettings,
  clickItem,
  captureScreenshot,
  SCREENSHOT_DIR,
} from "./utils";

// Run tests serially to maintain login state between related screenshots
test.describe.configure({ mode: "serial" });

test.describe("Portfolio Screenshots", () => {
  // Delete all existing screenshots before running full suite
  // Only runs when CLEAN_SCREENSHOTS=true environment variable is set
  test.beforeAll(() => {
    if (process.env.CLEAN_SCREENSHOTS === "true") {
      if (fs.existsSync(SCREENSHOT_DIR)) {
        const files = fs.readdirSync(SCREENSHOT_DIR);
        let deletedCount = 0;
        for (const file of files) {
          if (file.endsWith(".png")) {
            fs.unlinkSync(path.join(SCREENSHOT_DIR, file));
            deletedCount++;
          }
        }
        console.log(`🗑️  Deleted ${deletedCount} screenshots`);
      }
    }
  });

  // Clear any open dialogs before each test for resilience
  test.beforeEach(async ({ page }) => {
    await page.keyboard.press("Escape").catch(() => {});
  });

  // =========================================================================
  // Dark Mode Screenshots
  // =========================================================================

  test.describe("Dark Mode", () => {
    test("01 - Library Grid", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await waitForHero(page);
      await captureScreenshot(page, "01-library-grid");
    });

    test("02 - Tree View", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await clickItem(page, "Breaking Bad (2008)");
      await switchToTreeView(page);
      await page.waitForTimeout(500);

      // Collapse Seasons 1, 2, 3
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

    test("04 - TMDB Wizard", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      const addButton = page.getByRole("button", { name: /add/i });
      await addButton.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      const searchInput = page.getByPlaceholder(/search/i);
      await searchInput.fill("Dune");
      await page.waitForTimeout(1000);
      const result = page.getByRole("option").first();
      if (await result.isVisible()) {
        await result.click();
        await page.waitForTimeout(500);
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

    test("05 - Progress Tracking", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await clickItem(page, "Breaking Bad (2008)");
      await page.waitForLoadState("networkidle");
      const settingsButton = page.getByRole("button", { name: /settings/i });
      await settingsButton.click();
      await page.waitForTimeout(500);
      await captureScreenshot(page, "05-progress-tracking");
    });

    test("06 - Google Drive Sync", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await openSettings(page);
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible()) {
        await activityTab.click();
        await page.waitForTimeout(500);
      }
      await captureScreenshot(page, "06-google-drive-sync");
    });

    test("07 - Explore Page", async ({ page }) => {
      await setupForScreenshot(page, USERS.filmfan);
      await page.goto("/explore");
      await waitForHero(page);
      await page.waitForTimeout(1000);
      const dots = page.locator('button[aria-label^="Go to slide"]');
      await dots.nth(1).click();
      await page.waitForTimeout(1500);
      await captureScreenshot(page, "07-explore-page");
    });

    test("08 - Spotlight Search", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await openSpotlight(page);
      await captureScreenshot(page, "08-spotlight-search");
    });

    test("32 - Fork Dialog", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await page.goto("/explore");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollBy(0, 400));
      await page.waitForTimeout(500);
      const forkButton = page.getByRole("button", { name: /fork/i }).first();
      await forkButton.waitFor({ state: "visible", timeout: 10000 });
      await forkButton.click();
      await page.waitForSelector('[role="dialog"]', {
        state: "visible",
        timeout: 5000,
      });
      await page.waitForTimeout(1500);
      await captureScreenshot(page, "32-fork-dialog");
    });

    test("36 - Docs", async ({ page }) => {
      await page.goto("/docs");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(1000);
      await captureScreenshot(page, "36-docs");
    });
  });
});
