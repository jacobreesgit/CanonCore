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
      await page.waitForTimeout(1000);

      // Navigate to item detail via URL (more reliable than click on mobile)
      const gridCard = page
        .locator("[data-id]")
        .filter({
          has: page.locator('[data-testid="grid-item-title"]', {
            hasText: "Breaking Bad",
          }),
        })
        .first();
      await gridCard.waitFor({ state: "visible", timeout: 10000 });
      const itemId = await gridCard.getAttribute("data-id");
      await page.goto(`/u/demo/${itemId}`);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await switchToTreeView(page);

      // Collapse all seasons (they start expanded), then expand only Season 2
      const collapseButtons = page.getByRole("button", {
        name: /collapse item/i,
      });
      const count = await collapseButtons.count();
      for (let i = 0; i < count; i++) {
        await collapseButtons.first().click();
        await page.waitForTimeout(150);
      }

      // Expand Season 2
      const season2Item = page
        .getByRole("listitem")
        .filter({ hasText: "Season 2" });
      const expandButton = season2Item.getByRole("button", {
        name: /expand item/i,
      });
      await expandButton.click();
      await page.waitForTimeout(300);
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

    test("06 - Google Drive Sync", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await openSettings(page);

      // Desktop: tabs use role="tab"; Mobile: >3 tabs uses Select dropdown
      const activityTab = page.getByRole("tab", { name: /activity/i });
      if (await activityTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await activityTab.click();
      } else {
        // Mobile select dropdown
        const selectTrigger = page.getByRole("combobox", {
          name: /settings tabs/i,
        });
        await selectTrigger.click();
        await page.getByRole("option", { name: /activity/i }).click();
      }
      await page.waitForTimeout(500);
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

    test.only("08 - Spotlight Search", async ({ page }) => {
      await setupForScreenshot(page, USERS.demo);
      await openSpotlight(page);
      await page.waitForTimeout(4000);
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
