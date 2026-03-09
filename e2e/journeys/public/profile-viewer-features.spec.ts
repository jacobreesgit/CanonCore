/**
 * E2E tests for authenticated users viewing another user's public profile.
 * Covers viewer settings menu visibility on public item detail pages.
 */
import { test, expect } from "../../fixtures";

test.describe("Profile Viewer Features", () => {
  test("should see settings menu on another user's public item", async ({
    page,
    itemsCrud,
    publicProfile,
    publicUser,
  }) => {
    // Navigate to the public user's item detail page (settings menu is there)
    await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
      waitUntil: "domcontentloaded",
    });

    await publicProfile.expectForkButtonVisible();
  });
});
