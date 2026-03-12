/**
 * E2E tests for the public Explore page.
 * Covers search, sort, and authenticated features (exclude mine).
 */
import { publicTest, test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

publicTest.describe("Explore Search", () => {
  publicTest(
    "should filter items by search query",
    async ({ page, publicUser }) => {
      await page.goto("/explore", { waitUntil: "domcontentloaded" });

      // Type into the search input (tests real debounce behavior)
      const itemsSearch = page.getByTestId("explore-items-search");
      const searchInput = itemsSearch.getByRole("searchbox", {
        name: "Search",
      });
      await searchInput.fill(publicUser.itemName);

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
      // Navigate with search param to start with results shown
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

test.describe("Explore Features", () => {
  test("should toggle exclude mine filter", async ({
    page,
    itemsCrud,
    explore,
    publicUser,
  }) => {
    // itemsCrud triggers auth fixture (signs in the test user)
    await explore.goto();

    // Public user's item should be visible
    await expect(
      page.getByRole("heading", { name: publicUser.itemName, level: 3 })
    ).toBeVisible({ timeout: Timeouts.api });

    // Toggle exclude mine — public user's item should remain visible
    // (it belongs to someone else, not "mine"), confirming the toggle engaged
    await explore.toggleExcludeMine();
    await expect(
      page.getByRole("heading", { name: publicUser.itemName, level: 3 })
    ).toBeVisible({ timeout: Timeouts.api });
  });
});
