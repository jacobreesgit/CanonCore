/**
 * E2E tests for client-side search on the owner's profile page.
 * Uses authenticated fixture — test user is the profile owner.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { Timeouts } from "../../config/timeouts";

test.describe("Owner profile search", () => {
  test("filters items by search query and clears", async ({
    page,
    itemsCrud,
  }) => {
    const uniqueName = testId("searchable");
    const otherName = testId("other");

    // Create two items so we can verify filtering
    await itemsCrud.createItem(uniqueName);
    await itemsCrud.createItem(otherName);

    // Type in search input
    const searchInput = page.getByRole("searchbox", { name: /search/i });
    await searchInput.fill(uniqueName);

    // Verify only the matching item is visible
    await expect(
      page.getByRole("heading", { name: uniqueName, level: 3 })
    ).toBeVisible({ timeout: Timeouts.api });
    await expect(
      page.getByRole("heading", { name: otherName, level: 3 })
    ).not.toBeVisible();

    // Clear search
    await page.getByRole("button", { name: /clear search/i }).click();

    // Both items visible again
    await expect(
      page.getByRole("heading", { name: uniqueName, level: 3 })
    ).toBeVisible({ timeout: Timeouts.api });
    await expect(
      page.getByRole("heading", { name: otherName, level: 3 })
    ).toBeVisible({ timeout: Timeouts.api });
  });

  test("shows search-empty state when no matches", async ({
    page,
    itemsCrud,
  }) => {
    // Create an item so the profile isn't empty
    await itemsCrud.createItem(testId("filler"));

    const searchInput = page.getByRole("searchbox", { name: /search/i });
    await searchInput.fill("zzz-no-match-zzz");

    await expect(page.getByText(/no results found/i)).toBeVisible({
      timeout: Timeouts.api,
    });
  });
});
