/**
 * E2E tests for user bio feature.
 * Covers bio editing in settings and display on profile hero.
 */
import { test, expect } from "../../fixtures";

test.describe("User Bio", () => {
  test("can add bio in settings and see it on profile", async ({
    page,
    testUser,
    itemsCrud,
    settings,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.expectOpen();

    await settings.fillBio("Test bio for E2E testing purposes.");
    await settings.saveProfile();
    await settings.expectSaveSuccess();

    // Navigate to public profile and verify bio appears in hero
    await page.goto(`/u/${testUser.username}`);
    await expect(
      page.getByText("Test bio for E2E testing purposes.")
    ).toBeVisible();
  });
});
