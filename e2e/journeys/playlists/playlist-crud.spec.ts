/**
 * E2E tests for playlist CRUD operations.
 * Covers creating, navigating to detail, and deleting playlists.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { Timeouts } from "../../config/timeouts";

test.describe("Playlist CRUD", () => {
  test("should create a playlist via Add to Playlist dialog", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistName = testId("playlist");

    // Create an item first
    await itemsCrud.goto();
    await itemsCrud.createItem(itemName);
    await itemsCrud.clickItem(itemName);

    // Open Add to Playlist dialog and create a new playlist
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistName);
    await playlist.closeAddToPlaylistDialog();

    // Navigate to profile, switch to Playlists tab, verify playlist appears
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.expectPlaylistSectionVisible();
    await playlist.expectPlaylistCardVisible(playlistName);
  });

  test("should navigate to playlist detail and see hero", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistName = testId("playlist");

    // Setup: create item + playlist
    await itemsCrud.goto();
    await itemsCrud.createItem(itemName);
    await itemsCrud.clickItem(itemName);
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistName);
    await playlist.closeAddToPlaylistDialog();

    // Navigate to profile, switch to Playlists tab, click into detail
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.expectPlaylistSectionVisible();
    await playlist.clickPlaylistCard(playlistName);

    // Verify hero renders with playlist name
    await playlist.expectDetailHeroVisible();
    await playlist.expectDetailName(playlistName);
  });

  test("should delete playlist from detail page", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistName = testId("playlist");

    // Setup: create item + playlist
    await itemsCrud.goto();
    await itemsCrud.createItem(itemName);
    await itemsCrud.clickItem(itemName);
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistName);
    await playlist.closeAddToPlaylistDialog();

    // Navigate to playlist detail
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.clickPlaylistCard(playlistName);

    // Delete the playlist
    await playlist.deletePlaylistFromDetail();

    // Should redirect back to profile and playlist should be gone
    await expect(playlist["page"]).toHaveURL(new RegExp(`/u/`), {
      timeout: Timeouts.navigation,
    });
    await playlist.expectPlaylistCardNotVisible(playlistName);
  });
});
