/**
 * E2E tests for profile settings upload tab.
 * Covers opening the profile tab and verifying its content is visible.
 */
import { test, expect } from "../../fixtures";

test.describe("Settings Upload", () => {
  test("should open profile tab in settings", async ({
    page,
    itemsCrud,
    settings,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.expectOpen();
    await settings.switchToTab("profile");

    await expect(page.getByLabel(/display name/i)).toBeVisible();
  });
});
