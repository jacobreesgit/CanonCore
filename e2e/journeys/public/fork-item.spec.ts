/**
 * E2E tests for forking a public item.
 * Covers the full fork flow: clicking fork on another user's item,
 * verifying it completes, and confirming the fork button disappears.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Fork Item", () => {
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

    // Click fork
    await publicProfile.forkItem();

    // After fork API call + router.refresh(), the fork button disappears
    // (forkStatus.hasForked becomes true). Use api timeout since this
    // involves a POST request and server component refresh.
    await expect(page.getByTestId("profile-fork-button")).not.toBeVisible({
      timeout: Timeouts.api,
    });
  });
});
