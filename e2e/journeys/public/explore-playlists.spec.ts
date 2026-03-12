/**
 * E2E tests for the Playlists tab on the Explore page.
 * Verifies that public playlists are visible and searchable.
 */
import { publicTest, expect, prisma } from "../../fixtures";
import {
  createPublicUser,
  deletePublicUser,
} from "../../fixtures/authenticated.fixture";
import { Timeouts } from "../../config/timeouts";
import type { PublicUserInfo } from "../../fixtures/authenticated.fixture";

interface PlaylistExploreUser extends PublicUserInfo {
  playlistName: string;
}

const explorePlaylistsTest = publicTest.extend<{
  playlistUser: PlaylistExploreUser;
}>({
  playlistUser: async ({}, use) => {
    const user = await createPublicUser();

    const playlistName = `playlist-${user.username}`;
    const playlist = await prisma.playlist.create({
      data: {
        name: playlistName,
        order: 0,
        isPublic: true,
        userId: user.id,
      },
    });
    await prisma.playlistItem.create({
      data: {
        playlistId: playlist.id,
        itemId: user.itemId,
        order: 0,
      },
    });

    await use({ ...user, playlistName });
    await deletePublicUser(user.id);
  },
});

explorePlaylistsTest.describe("Explore Playlists Tab", () => {
  explorePlaylistsTest(
    "should show public playlists on the Playlists tab",
    async ({ page, playlistUser }) => {
      await page.goto("/explore", { waitUntil: "domcontentloaded" });

      // Switch to Playlists tab
      await page
        .getByRole("tab", { name: "Playlists" })
        .click({ timeout: Timeouts.api });

      // The playlist should be visible
      await expect(
        page.getByText(playlistUser.playlistName).first()
      ).toBeVisible({ timeout: Timeouts.api });
    }
  );

  explorePlaylistsTest(
    "should search playlists on the Playlists tab",
    async ({ page, playlistUser }) => {
      await page.goto("/explore", { waitUntil: "domcontentloaded" });

      // Switch to Playlists tab
      await page
        .getByRole("tab", { name: "Playlists" })
        .click({ timeout: Timeouts.api });

      // Search for our playlist
      const playlistsSearch = page.getByTestId("explore-playlists-search");
      const searchInput = playlistsSearch.getByRole("searchbox", {
        name: "Search",
      });
      await searchInput.fill(playlistUser.playlistName);

      // Our playlist should still be visible after search
      await expect(
        page.getByText(playlistUser.playlistName).first()
      ).toBeVisible({ timeout: Timeouts.api });
    }
  );
});
