/**
 * E2E tests for authentication redirects.
 * Verifies that authenticated users are redirected away from auth pages.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Auth Redirect", () => {
  test("should redirect authenticated users away from sign-in page", async ({
    page,
    testUser,
  }) => {
    await page.goto("/sign-in");
    // Without loading.tsx, the redirect + page render blocks longer on mobile
    await expect(page).toHaveURL(`/u/${testUser.username}`, {
      timeout: Timeouts.upload,
    });
  });
});
