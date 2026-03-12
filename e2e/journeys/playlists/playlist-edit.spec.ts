/**
 * E2E tests for editing a playlist.
 * Covers renaming a playlist via the detail page settings menu.
 */
import { test, expect } from "../../fixtures";
import { testId } from "../../config/test-data";
import { Timeouts } from "../../config/timeouts";

test.describe("Playlist Edit", () => {
  test("should rename playlist from detail page", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistName = testId("playlist");
    const newName = testId("renamed-playlist");

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

    // Edit the playlist name
    await playlist.editPlaylistFromDetail();
    await playlist.editPlaylistName(newName);
    await playlist.savePlaylistEdit();

    // Verify the new name is visible in the hero
    await playlist.expectDetailName(newName);
  });
});
