/**
 * E2E tests for playlist item management.
 * Covers adding items to playlists, removing items, and creating
 * new playlists from within the Add to Playlist dialog.
 */
import { test } from "../../fixtures";
import { testId } from "../../config/test-data";

test.describe("Playlist Items", () => {
  test("should add item to playlist via checkbox", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistName = testId("playlist");

    // Create an item
    await itemsCrud.goto();
    await itemsCrud.createItem(itemName);
    await itemsCrud.clickItem(itemName);

    // Create a playlist from the dialog
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistName);

    // The newly created playlist should be checked already (item auto-added)
    // Close and verify by navigating to the playlist
    await playlist.closeAddToPlaylistDialog();

    // Go to profile, switch to Playlists tab, click into the playlist
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.clickPlaylistCard(playlistName);

    // Verify item is visible in the playlist grid
    await playlist.expectDetailItemVisible(itemName);
  });

  test("should remove item from playlist via checkbox toggle", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistName = testId("playlist");

    // Create item + playlist with item added
    await itemsCrud.goto();
    await itemsCrud.createItem(itemName);
    await itemsCrud.clickItem(itemName);
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistName);

    // Uncheck the playlist to remove the item
    await playlist.togglePlaylistCheckbox(playlistName);
    await playlist.closeAddToPlaylistDialog();

    // Navigate to playlist — item should not be there
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.clickPlaylistCard(playlistName);
    await playlist.expectDetailHeroVisible();

    // The playlist should show empty state (no items)
    await playlist.expectDetailItemNotVisible(itemName);
  });

  test("should create new playlist from dialog and add item", async ({
    itemsCrud,
    playlist,
  }) => {
    const itemName = testId("movie");
    const playlistA = testId("playlist");
    const playlistB = testId("playlist");

    // Create item and first playlist
    await itemsCrud.goto();
    await itemsCrud.createItem(itemName);
    await itemsCrud.clickItem(itemName);
    await playlist.openAddToPlaylistDialog();
    await playlist.createPlaylistFromDialog(playlistA);

    // Create second playlist from the same dialog
    await playlist.createPlaylistFromDialog(playlistB);
    await playlist.closeAddToPlaylistDialog();

    // Both playlists should exist on profile
    await playlist.gotoProfile();
    await playlist.switchToPlaylistsTab();
    await playlist.expectPlaylistCardVisible(playlistA);
    await playlist.expectPlaylistCardVisible(playlistB);
  });
});
