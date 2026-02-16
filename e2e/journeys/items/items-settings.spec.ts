/**
 * E2E tests for item settings dialog.
 * Covers opening/closing the settings dialog and renaming items.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Items Settings", () => {
  test("should open and close settings dialog", async ({
    itemsCrud,
    itemsSettings,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemsSettings.openSettings(name);
    await itemsSettings.expectSettingsOpen();

    await itemsSettings.close();
    await itemsSettings.expectSettingsClosed();
  });

  test("should rename item via settings", async ({
    itemsCrud,
    itemsSettings,
  }) => {
    const originalName = testId("movie");
    const newName = testId("renamed");

    await itemsCrud.goto();
    await itemsCrud.createItem(originalName);

    await itemsSettings.openSettings(originalName);
    await itemsSettings.rename(newName);
    await itemsSettings.save();

    await itemsCrud.expectItemVisible(newName);
  });
});
