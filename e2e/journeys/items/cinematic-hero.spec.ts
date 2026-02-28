/**
 * E2E tests for the cinematic hero section and colour theming pipeline.
 * Verifies the hero carousel is displayed when navigating to an item,
 * and that colour theming is applied across item detail, profile, and
 * playlist detail pages when TMDB metadata provides a dominant colour.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Cinematic Hero", () => {
  test("should show hero when navigating to item detail", async ({
    itemsCrud,
    itemDetail,
  }) => {
    const name = testId("movie");
    await itemsCrud.goto();
    await itemsCrud.createItem(name);

    await itemDetail.goto(name);
    await itemDetail.expectHeroVisible();
  });

  test("should apply colour theming when item has dominant colour", async ({
    itemsCrud,
    itemDetail,
    tmdbWizard,
    page,
  }) => {
    test.skip(!process.env.TMDB_API_KEY, "TMDB_API_KEY not set");

    // Create an item with TMDB metadata (which populates dominantColour)
    await itemsCrud.goto();
    await tmdbWizard.createItemWithTmdb("The Dark Knight");
    await itemsCrud.expectItemVisible("The Dark Knight (2008)");

    // Navigate to the item detail page
    await itemDetail.goto("The Dark Knight (2008)");
    await itemDetail.expectHeroVisible();

    // Assert the page wrapper has inline CSS custom properties from colour theming.
    // HeroContentLayout applies --dark-* shades as inline styles when dominantColour is set.
    const wrapper = page.locator("[style*='--dark-']");
    await expect(wrapper.first()).toBeVisible();

    // Verify key shade properties are present in the style attribute
    const style = await wrapper.first().getAttribute("style");
    expect(style).toContain("--dark-700");
    expect(style).toContain("--dark-900");
  });

  test.skip("should apply colour theming on profile page when hero image has colour", async () => {
    // TODO: Requires SettingsPage POM to support hero image upload
    // Once available:
    // 1. Upload hero image via settings (triggers colour extraction)
    // 2. Navigate to profile page
    // 3. Assert [style*='--dark-'] wrapper has --dark-700 and --dark-900
  });

  test("should apply colour theming on playlist detail page via item fallback", async ({
    itemsCrud,
    itemDetail,
    tmdbWizard,
    playlist,
    page,
  }) => {
    test.skip(!process.env.TMDB_API_KEY, "TMDB_API_KEY not set");

    const playlistName = testId("playlist");

    // Create an item with TMDB metadata (which populates dominantColour)
    await itemsCrud.goto();
    await tmdbWizard.createItemWithTmdb("The Dark Knight");
    await itemsCrud.expectItemVisible("The Dark Knight (2008)");

    // Navigate to item detail and add it to a new playlist
    await itemDetail.goto("The Dark Knight (2008)");
    await itemDetail.expectHeroVisible();
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistName);
    await playlist.closeAddToPlaylistDialog();

    // Navigate to the playlist detail page via the profile
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.clickPlaylistCard(playlistName);
    await playlist.expectDetailHeroVisible();

    // Assert the page wrapper has inline CSS custom properties from colour theming.
    // Playlist detail resolves colour from playlist.dominantColour -> first item fallback.
    // The TMDB item's dominantColour should propagate via the first-item fallback.
    const wrapper = page.locator("[style*='--dark-']");
    await expect(wrapper.first()).toBeVisible();

    // Verify key shade properties are present in the style attribute
    const style = await wrapper.first().getAttribute("style");
    expect(style).toContain("--dark-700");
    expect(style).toContain("--dark-900");
  });
});
