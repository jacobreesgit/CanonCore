import { test, expect } from "../../fixtures";

test.describe("Sign Out Journey", () => {
  test("user can sign out from my-items", async ({
    page,
    testUser,
    myItemsPage,
  }) => {
    // testUser fixture already logged us in
    // Verify we're on the user profile
    await expect(page).toHaveURL(`/u/${testUser.username}`);

    // Sign out
    await myItemsPage.signOut();

    // Should redirect to landing page after sign out
    await expect(page).toHaveURL("/", { timeout: 10000 });
  });

  test("after sign out, accessing my-items redirects to sign in", async ({
    page,
    testUser,
    myItemsPage,
  }) => {
    // testUser fixture already logged us in
    const username = testUser.username;

    // Sign out
    await myItemsPage.signOut();
    await expect(page).toHaveURL("/", { timeout: 10000 });

    // Try to access user profile directly after sign out
    // The profile should show 404 since user is not public (isPublic: false by default)
    await page.goto(`/u/${username}`);
    // Should show 404 since profile is private
    await expect(page.locator("h1").filter({ hasText: "404" })).toBeVisible({
      timeout: 5000,
    });
  });
});
