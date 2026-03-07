/**
 * E2E tests for inline search on the Explore page.
 * Uses a self-contained public user fixture — no seed dependency.
 */
import { publicTest, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Explore Search", () => {
  publicTest(
    "should filter items by search query",
    async ({ page, publicUser }) => {
      // Navigate with search param to bypass debounce timing issues
      await page.goto(`/explore?q=${encodeURIComponent(publicUser.itemName)}`, {
        waitUntil: "domcontentloaded",
      });

      // Our item should appear in the grid as an h3 heading
      await expect(
        page.getByRole("heading", { name: publicUser.itemName, level: 3 })
      ).toBeVisible({
        timeout: Timeouts.api,
      });
    }
  );

  publicTest(
    "should clear search and show all items",
    async ({ page, publicUser }) => {
      // Start with a search active
      await page.goto(`/explore?q=${encodeURIComponent(publicUser.itemName)}`, {
        waitUntil: "domcontentloaded",
      });

      // Wait for search result to appear
      await expect(
        page.getByRole("heading", { name: publicUser.itemName, level: 3 })
      ).toBeVisible({
        timeout: Timeouts.api,
      });

      // Clear the search — retry click+assert to handle slow hydration under load
      const itemsSearch = page.getByTestId("explore-items-search");
      const clearButton = itemsSearch.getByRole("button", {
        name: "Clear search",
      });
      const searchInput = itemsSearch.getByRole("searchbox", {
        name: "Search",
      });

      await expect(async () => {
        await clearButton.click();
        await expect(searchInput).toHaveValue("", { timeout: 2_000 });
      }).toPass({ timeout: Timeouts.api });
    }
  );
});
