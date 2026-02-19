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

publicTest.describe("Playlist Visibility", () => {
  let userId: string;
  let username: string;

  publicTest.beforeAll(async () => {
    // Create a public user with items and playlists directly in DB
    const user = await createPublicUser();
    userId = user.id;
    username = user.username;

    // Create a second public item
    const item2 = await prisma.item.create({
      data: {
        name: `public-item-2-${username}`,
        userId,
        isPublic: true,
        inheritVisibility: false,
      },
    });

    // Create a public playlist with the public items
    const publicPlaylist = await prisma.playlist.create({
      data: {
        name: "Public Weekend Picks",
        description: "A curated list for the weekend.",
        order: 0,
        isPublic: true,
        userId,
      },
    });
    await prisma.playlistItem.createMany({
      data: [
        { playlistId: publicPlaylist.id, itemId: user.itemId, order: 0 },
        { playlistId: publicPlaylist.id, itemId: item2.id, order: 1 },
      ],
    });

    // Create a private playlist (should NOT be visible to viewers)
    const privatePlaylist = await prisma.playlist.create({
      data: {
        name: "Private Watch Later",
        description: "For my eyes only.",
        order: 1,
        isPublic: false,
        userId,
      },
    });
    await prisma.playlistItem.create({
      data: {
        playlistId: privatePlaylist.id,
        itemId: user.itemId,
        order: 0,
      },
    });
  });

  publicTest.afterAll(async () => {
    await deletePublicUser(userId);
  });

  publicTest(
    "should show public playlists on public profile",
    async ({ page }) => {
      await page.goto(`/u/${username}`);
      await page.waitForLoadState("domcontentloaded");

      // Switch to Playlists tab (viewer profiles now use tabs)
      await page
        .getByRole("tab", { name: "Playlists" })
        .click({ timeout: Timeouts.api });

      // Public playlist should be visible
      const playlistSection = page.getByTestId("playlist-section");
      await expect(playlistSection).toBeVisible({
        timeout: Timeouts.api,
      });
      await expect(
        playlistSection.getByText("Public Weekend Picks")
      ).toBeVisible({
        timeout: Timeouts.api,
      });
    }
  );

  publicTest(
    "should hide private playlists from public profile",
    async ({ page }) => {
      await page.goto(`/u/${username}`);
      await page.waitForLoadState("domcontentloaded");

      // Switch to Playlists tab (viewer profiles now use tabs)
      await page
        .getByRole("tab", { name: "Playlists" })
        .click({ timeout: Timeouts.api });

      // Private playlist should NOT be visible
      await expect(page.getByText("Private Watch Later")).not.toBeVisible({
        timeout: Timeouts.animation,
      });
    }
  );
});
