/**
 * E2E tests for site header auto-hide on scroll.
 * Header hides when scrolling down past threshold, reappears on scroll up.
 * Desktop only — header uses lg:flex (hidden on mobile).
 */

import { test, expect, prisma } from "../../fixtures";

test.describe("Site Header Auto-Hide", () => {
  test("hides header on scroll down and shows on scroll up", async ({
    page,
    testUser,
    isMobile,
  }) => {
    test.skip(isMobile, "Site header hidden on mobile (lg:flex only)");

    // Create items via DB for speed (avoids slow UI creation)
    for (let i = 0; i < 8; i++) {
      await prisma.item.create({
        data: {
          name: `Scroll Item ${i}`,
          userId: testUser.id,
          order: i,
          depth: 0,
        },
      });
    }

    await page.goto(`/u/${testUser.username}`);
    await page.waitForLoadState("networkidle");

    const header = page.locator("header");
    await expect(header).toBeVisible();

    // Scroll down past threshold (64px)
    await page.evaluate(() => {
      const main = document.getElementById("main-content");
      (main ?? window).scrollTo({ top: 400, behavior: "instant" });
    });
    // Allow scroll handler's rAF to fire
    await page.waitForTimeout(200);

    // Header should be hidden (translated up via -translate-y-full)
    await expect(header).toHaveClass(/-translate-y-full/, { timeout: 3000 });

    // Scroll back up
    await page.evaluate(() => {
      const main = document.getElementById("main-content");
      (main ?? window).scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForTimeout(200);

    // Header should be visible again
    await expect(header).not.toHaveClass(/-translate-y-full/, {
      timeout: 3000,
    });
  });
});
