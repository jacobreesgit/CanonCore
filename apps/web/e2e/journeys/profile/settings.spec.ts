/**
 * E2E tests for profile settings dialog.
 * Covers tab navigation and display name editing.
 */
import { test } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Profile Settings", () => {
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
