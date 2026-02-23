/**
 * E2E tests for item settings dialog.
 * Covers opening/closing the settings dialog, renaming items,
 * and TMDB metadata section interactions.
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

  // TMDB tests require external API — skip if TMDB_API_KEY is not set
  test("should show TMDB metadata section in settings", async ({
    itemsCrud,
    itemsSettings,
    tmdbWizard,
  }) => {
    test.skip(!process.env.TMDB_API_KEY, "TMDB_API_KEY not set");

    await itemsCrud.goto();
    await tmdbWizard.createItemWithTmdb("The Dark Knight");
    await itemsCrud.expectItemVisible("The Dark Knight (2008)");

    await itemsSettings.openSettings("The Dark Knight (2008)");
    await itemsSettings.switchToTmdbTab();
    await itemsSettings.expectTmdbMetadataVisible();
  });

  test("should detach TMDB metadata via settings", async ({
    itemsCrud,
    itemsSettings,
    tmdbWizard,
  }) => {
    test.skip(!process.env.TMDB_API_KEY, "TMDB_API_KEY not set");

    await itemsCrud.goto();
    await tmdbWizard.createItemWithTmdb("Inception");
    await itemsCrud.expectItemVisible("Inception (2010)");

    await itemsSettings.openSettings("Inception (2010)");
    // Detach is on the Details tab (TmdbSourceField), not the TMDB tab
    await itemsSettings.detachTmdb();
    await itemsSettings.expectTmdbTabGone();
  });
});
