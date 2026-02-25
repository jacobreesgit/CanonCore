/**
 * E2E tests for forking a public item.
 * Covers the full fork flow: clicking fork on another user's item,
 * verifying it completes, and confirming the fork button disappears.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Fork Item", () => {
  // Fork API can be slow under parallel load — extend timeout
  test.setTimeout(60_000);

  test("should fork a public item to own library", async ({
    page,
    testUser: _testUser,
    publicProfile,
    publicUser,
  }) => {
    // Navigate to the public user's item detail page
    await page.goto(`/u/${publicUser.username}/${publicUser.itemId}`, {
      waitUntil: "domcontentloaded",
    });

    // Fork button should be visible for authenticated non-owner
    await publicProfile.expectForkButtonVisible();

    // Click fork — POM retries click until hydrated handler fires.
    await publicProfile.forkItem();

    // Button disappears via optimistic state update after API responds.
    // Under parallel load, the fork API can be slow.
    await expect(page.getByTestId("profile-fork-button")).not.toBeVisible({
      timeout: Timeouts.heavy,
    });
  });
});
