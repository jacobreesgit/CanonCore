/**
 * E2E tests for the TMDB wizard flow and About tab.
 * Verifies searching TMDB, applying metadata via the wizard,
 * creating an item with TMDB data, and viewing the About tab.
 *
 * Requires TMDB_API_KEY to be set in the environment.
 */
import { test } from "../../fixtures";

test.describe("TMDB Wizard & About Tab", () => {
  test("should search TMDB, complete wizard, create item, and show About tab", async ({
    itemsCrud,
    itemDetail,
    tmdbWizard,
  }) => {
    await itemsCrud.goto();

    // Search TMDB and complete the wizard flow
    await tmdbWizard.openAddItemDialog();
    await tmdbWizard.searchAndSelectFirst("The Matrix");
    await tmdbWizard.completeTextStep();
    await tmdbWizard.skipArtworkSteps();
    await tmdbWizard.applyWizard();
    await tmdbWizard.createFromSummary();

    // Verify item was created with TMDB-formatted name
    await itemsCrud.expectItemVisible("The Matrix (1999)");

    // Navigate to item detail and verify About tab
    await itemsCrud.clickItem("The Matrix (1999)");
    await itemDetail.expectDetailVisible();
    await itemDetail.switchToAboutTab();
    await itemDetail.expectAboutContent();
  });
});
