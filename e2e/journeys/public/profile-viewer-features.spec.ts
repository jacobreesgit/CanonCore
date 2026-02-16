/**
 * E2E tests for authenticated users viewing another user's public profile.
 * Covers fork button visibility on public item detail pages.
 */
import { test, expect } from "../../fixtures";

test.describe("Profile Viewer Features", () => {
  test("should see fork button on another user's public item", async ({
    page,
    itemsCrud,
    publicProfile,
    publicUser,
  }) => {
    // Navigate to the public user's item detail page (fork button is there)
    await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
      waitUntil: "domcontentloaded",
    });

    await publicProfile.expectForkButtonVisible();
  });
});
