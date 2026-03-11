/**
 * E2E tests for viewing a public playlist detail page.
 * Verifies that unauthenticated users can view shared playlists.
 */
import { publicTest, expect, prisma } from "../../fixtures";
import {
  createPublicUser,
  deletePublicUser,
} from "../../fixtures/authenticated.fixture";
import { Timeouts } from "../../config/timeouts";
import type { PublicUserInfo } from "../../fixtures/authenticated.fixture";

interface PlaylistDetailUser extends PublicUserInfo {
  playlistId: string;
  playlistName: string;
}

const playlistDetailTest = publicTest.extend<{
  detailUser: PlaylistDetailUser;
}>({
  detailUser: async ({}, use) => {
    const user = await createPublicUser();

    const playlistName = `detail-playlist-${user.username}`;
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

    await use({ ...user, playlistId: playlist.id, playlistName });
    await deletePublicUser(user.id);
  },
});

playlistDetailTest.describe("Public Playlist Detail", () => {
  playlistDetailTest(
    "should display playlist name and items for viewer",
    async ({ page, detailUser }) => {
      await page.goto(
        `/u/${detailUser.username}/playlists/${detailUser.playlistId}`,
        { waitUntil: "domcontentloaded" }
      );

      // Playlist detail should load with hero
      await expect(page.getByTestId("playlist-detail")).toBeVisible({
        timeout: Timeouts.navigation,
      });

      // Playlist name should be visible in the hero
      await expect(
        page.getByTestId("hero-carousel").getByText(detailUser.playlistName)
      ).toBeVisible({ timeout: Timeouts.api });

      // The item should be visible in the playlist
      await expect(
        page.getByRole("button", { name: detailUser.itemName })
      ).toBeVisible({ timeout: Timeouts.navigation });
    }
  );
});
