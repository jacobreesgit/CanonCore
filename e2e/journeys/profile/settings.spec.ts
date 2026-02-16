/**
 * E2E tests for profile settings dialog.
 * Covers opening, tab navigation, display name editing, and saving.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Profile Settings", () => {
  test("should open settings dialog", async ({ itemsCrud, settings }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.expectOpen();
  });

  test("should switch between settings tabs", async ({
    itemsCrud,
    settings,
  }) => {
    await itemsCrud.goto();
    await settings.open();
    await settings.expectOpen();

    await settings.switchToTab("account");
    await settings.switchToTab("connections");
    await settings.switchToTab("profile");
  });

  test("should update display name", async ({ itemsCrud, settings }) => {
    const displayName = testId("name");

    await itemsCrud.goto();
    await settings.open();
    await settings.expectOpen();
    await settings.fillDisplayName(displayName);
    await settings.saveProfile();
    await settings.expectSaveSuccess();
  });
});
