/**
 * E2E tests for the sign-out flow.
 * Verifies that signing out redirects to the landing page.
 */
import { test, expect } from "../../fixtures";
import { Timeouts } from "../../config/timeouts";

test.describe("Sign Out", () => {
  test("should sign out and redirect to landing page", async ({
    page,
    nav,
    testUser,
  }) => {
    await nav.signOut();
    await expect(page).toHaveURL("/", {
      timeout: Timeouts.navigation,
    });
  });
});
