/**
 * Retake screenshots 08 and 14 at 1668 x 2420 px (iPad Pro 11" ratio).
 *
 * Run with: npx playwright test --config=e2e/screenshots/playwright.config.ts e2e/screenshots/retake-hero.spec.ts
 */

import { test } from "@playwright/test";
import {
  USERS,
  setupForScreenshot,
  waitForHero,
  openSpotlight,
  captureScreenshot,
} from "./utils";

// Configure for iPad with 1668 x 2420 px
test.use({
  viewport: { width: 1668, height: 2420 },
  userAgent:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

test.describe("Hero Screenshots (1668x2420 iPad)", () => {
  test("08 - Spotlight Search", async ({ page }) => {
    await setupForScreenshot(page, USERS.demo);
    // Navigate to explore page
    await page.goto("/explore");
    await page.waitForLoadState("networkidle");
    await openSpotlight(page);
    await page.waitForLoadState("networkidle");
    await captureScreenshot(page, "08-spotlight-search");
  });

  test("01 - Library Grid", async ({ page }) => {
    await setupForScreenshot(page, USERS.demo);
    // Root page defaults to grid view
    await waitForHero(page);
    await captureScreenshot(page, "01-library-grid");
  });
});
