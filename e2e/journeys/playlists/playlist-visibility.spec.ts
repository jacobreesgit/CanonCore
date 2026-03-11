/**
 * E2E tests for playlist visibility on public profiles.
 * Verifies that public playlists appear for unauthenticated viewers
 * and private playlists are hidden.
 */
import { publicTest, expect, prisma } from "../../fixtures";
import {
  createPublicUser,
  deletePublicUser,
} from "../../fixtures/authenticated.fixture";
import { Timeouts } from "../../config/timeouts";
import type { PublicUserInfo } from "../../fixtures/authenticated.fixture";

interface PlaylistVisibilityUser extends PublicUserInfo {
  publicPlaylistName: string;
  privatePlaylistName: string;
}

const playlistVisibilityTest = publicTest.extend<{
  visibilityUser: PlaylistVisibilityUser;
}>({
  visibilityUser: async ({}, use) => {
    const user = await createPublicUser();

    // Create a second public item
    const item2 = await prisma.item.create({
      data: {
        name: `public-item-2-${user.username}`,
        userId: user.id,
        isPublic: true,
        inheritVisibility: false,
      },
    });

    // Create a public playlist with the public items
    const publicPlaylistName = "Public Weekend Picks";
    const publicPlaylist = await prisma.playlist.create({
      data: {
        name: publicPlaylistName,
        description: "A curated list for the weekend.",
        order: 0,
        isPublic: true,
        userId: user.id,
      },
    });
    await prisma.playlistItem.createMany({
      data: [
        { playlistId: publicPlaylist.id, itemId: user.itemId, order: 0 },
        { playlistId: publicPlaylist.id, itemId: item2.id, order: 1 },
      ],
    });

    // Create a private playlist (should NOT be visible to viewers)
    const privatePlaylistName = "Private Watch Later";
    const privatePlaylist = await prisma.playlist.create({
      data: {
        name: privatePlaylistName,
        description: "For my eyes only.",
        order: 1,
        isPublic: false,
        userId: user.id,
      },
    });
    await prisma.playlistItem.create({
      data: {
        playlistId: privatePlaylist.id,
        itemId: user.itemId,
        order: 0,
      },
    });

    await use({
      ...user,
      publicPlaylistName,
      privatePlaylistName,
    });

    await deletePublicUser(user.id);
  },
});

playlistVisibilityTest.describe("Playlist Visibility", () => {
  playlistVisibilityTest(
    "should show public playlists on public profile",
    async ({ page, visibilityUser }) => {
      await page.goto(`/u/${visibilityUser.username}`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: Timeouts.navigation,
      });

      // Switch to Playlists tab (viewer profiles now use tabs)
      await page
        .getByRole("tab", { name: "Playlists" })
        .click({ timeout: Timeouts.api });

      // Public playlist should be visible
      const playlistSection = page.getByTestId("playlist-section");
      await expect(playlistSection).toBeVisible({
        timeout: Timeouts.api,
      });
      // CardShell renders the name twice (default + hover overlay), use .first()
      await expect(
        playlistSection.getByText(visibilityUser.publicPlaylistName).first()
      ).toBeVisible({
        timeout: Timeouts.api,
      });
    }
  );

  playlistVisibilityTest(
    "should hide private playlists from public profile",
    async ({ page, visibilityUser }) => {
      await page.goto(`/u/${visibilityUser.username}`);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByTestId("hero-carousel")).toBeVisible({
        timeout: Timeouts.navigation,
      });

      // Switch to Playlists tab (viewer profiles now use tabs)
      await page
        .getByRole("tab", { name: "Playlists" })
        .click({ timeout: Timeouts.api });

      // Private playlist should NOT be visible
      await expect(
        page.getByText(visibilityUser.privatePlaylistName)
      ).not.toBeVisible({
        timeout: Timeouts.animation,
      });
    }
  );
});
