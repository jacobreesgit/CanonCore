/**
 * E2E tests for cursor-based infinite scroll on the Explore page.
 * Uses paginationUser fixture (26 items) to exceed PAGE_SIZE of 24.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Explore Pagination", () => {
  // Creating 26 items + scrolling can be slow
  publicTest.setTimeout(60_000);

  publicTest(
    "should load more items on scroll",
    async ({ page, paginationUser }) => {
      // Navigate with search param to isolate this user's items from other workers
      await page.goto(
        `/explore?q=${encodeURIComponent(paginationUser.username)}`,
        { waitUntil: "domcontentloaded" }
      );

      // Items are sorted updatedAt DESC — the most recently created item appears first
      const newestItem =
        paginationUser.itemNames[paginationUser.itemNames.length - 1];

      // Wait for initial content to render — items appear as h3 headings
      await expect(
        page.getByRole("heading", { name: newestItem, level: 3 })
      ).toBeVisible({ timeout: Timeouts.api });

      // Count initial visible items — slugify converts underscores to hyphens
      const slugUsername = paginationUser.username.replace(/_/g, "-");
      const itemCards = page.locator(
        `[data-testid^="item-card-"][data-testid*="${slugUsername}"]`
      );

      // Should have at most 24 initially (PAGE_SIZE = 24)
      const initialCount = await itemCards.count();
      expect(initialCount).toBeGreaterThan(0);
      expect(initialCount).toBeLessThanOrEqual(24);

      // Scroll to trigger infinite scroll — try both the main content container
      // and window.scrollTo for robustness across viewport sizes
      await expect(async () => {
        await page.evaluate(() => {
          const main = document.getElementById("main-content");
          if (main) main.scrollTo(0, main.scrollHeight);
          window.scrollTo(0, document.body.scrollHeight);
        });
        const afterScrollCount = await itemCards.count();
        expect(afterScrollCount).toBeGreaterThan(initialCount);
      }).toPass({ timeout: Timeouts.api });
    }
  );
});
