/**
 * Integration tests for playlist visibility filtering.
 * Tests that public queries correctly filter by playlist and item visibility.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getPublicPlaylistsForUser,
  getPublicPlaylist,
} from "@/lib/public-auth";
import "../setup";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

const TEST_EMAIL = `playlist-vis-${Date.now()}@test.example.com`;
let testUserId: string;
let publicItemId: string;
let privateItemId: string;

describe("playlist visibility integration", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: "hashed",
        isPublic: true,
        username: `vistest${Date.now()}`,
      },
    });
    testUserId = user.id;

    const publicItem = await prisma.item.create({
      data: { name: "Public Item", userId: testUserId, isPublic: true },
    });
    publicItemId = publicItem.id;

    const privateItem = await prisma.item.create({
      data: { name: "Private Item", userId: testUserId, isPublic: false },
    });
    privateItemId = privateItem.id;
  });

  afterAll(async () => {
    await prisma.playlistItem.deleteMany({
      where: { playlist: { userId: testUserId } },
    });
    await prisma.playlist.deleteMany({ where: { userId: testUserId } });
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it("shows public playlist with public items to viewer", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Public Playlist",
        userId: testUserId,
        isPublic: true,
        order: 0,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: publicItemId, order: 0 },
    });

    const result = await getPublicPlaylistsForUser({ userId: testUserId });
    expect(result.items.some((p) => p.id === playlist.id)).toBe(true);

    const detail = await getPublicPlaylist(playlist.id);
    expect(detail).not.toBeNull();
    expect(detail!.items).toHaveLength(1);
    expect(detail!.items[0].id).toBe(publicItemId);
  });

  it("filters private items from public playlist", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Mixed Playlist",
        userId: testUserId,
        isPublic: true,
        order: 1,
      },
    });
    await prisma.playlistItem.createMany({
      data: [
        { playlistId: playlist.id, itemId: publicItemId, order: 0 },
        { playlistId: playlist.id, itemId: privateItemId, order: 1 },
      ],
    });

    const detail = await getPublicPlaylist(playlist.id);
    expect(detail).not.toBeNull();
    expect(detail!.items).toHaveLength(1);
    expect(detail!.items[0].id).toBe(publicItemId);
  });

  it("hides public playlist with all private items", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "All Private",
        userId: testUserId,
        isPublic: true,
        order: 2,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: privateItemId, order: 0 },
    });

    const result = await getPublicPlaylistsForUser({ userId: testUserId });
    expect(result.items.some((p) => p.id === playlist.id)).toBe(false);

    const detail = await getPublicPlaylist(playlist.id);
    expect(detail).toBeNull();
  });

  it("hides private playlist from viewer entirely", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Private Playlist",
        userId: testUserId,
        isPublic: false,
        order: 3,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: publicItemId, order: 0 },
    });

    const result = await getPublicPlaylistsForUser({ userId: testUserId });
    expect(result.items.some((p) => p.id === playlist.id)).toBe(false);
  });

  it("hides playlist when owner profile is private", async () => {
    // Create a private-profile user with a public playlist
    const privateUser = await prisma.user.create({
      data: {
        email: `private-user-${Date.now()}@test.example.com`,
        passwordHash: "hashed",
        isPublic: false,
        username: `privatevis${Date.now()}`,
      },
    });
    const item = await prisma.item.create({
      data: {
        name: "Private User Item",
        userId: privateUser.id,
        isPublic: true,
      },
    });
    const playlist = await prisma.playlist.create({
      data: {
        name: "Should Be Hidden",
        userId: privateUser.id,
        isPublic: true,
        order: 0,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: item.id, order: 0 },
    });

    // Should not be accessible (owner profile is private)
    const detail = await getPublicPlaylist(playlist.id);
    expect(detail).toBeNull();

    // Cleanup
    await prisma.playlistItem.deleteMany({
      where: { playlistId: playlist.id },
    });
    await prisma.playlist.delete({ where: { id: playlist.id } });
    await prisma.item.delete({ where: { id: item.id } });
    await prisma.user.delete({ where: { id: privateUser.id } });
  });

  it("allows access to unlisted playlist with valid share token", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Unlisted Shared",
        userId: testUserId,
        isPublic: false,
        shareToken: `test-token-${Date.now()}`,
        order: 10,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: publicItemId, order: 0 },
    });

    const detail = await getPublicPlaylist(playlist.id, playlist.shareToken);
    expect(detail).not.toBeNull();
    expect(detail!.items).toHaveLength(1);
  });

  it("rejects access to unlisted playlist with invalid token", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Unlisted Bad Token",
        userId: testUserId,
        isPublic: false,
        shareToken: `valid-token-${Date.now()}`,
        order: 11,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: publicItemId, order: 0 },
    });

    const detail = await getPublicPlaylist(playlist.id, "wrong-token");
    expect(detail).toBeNull();
  });

  it("rejects access to unlisted playlist without token", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Unlisted No Token",
        userId: testUserId,
        isPublic: false,
        shareToken: `no-token-${Date.now()}`,
        order: 12,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: publicItemId, order: 0 },
    });

    const detail = await getPublicPlaylist(playlist.id);
    expect(detail).toBeNull();
  });

  it("ignores token for public playlists", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Public With Token",
        userId: testUserId,
        isPublic: true,
        shareToken: `public-token-${Date.now()}`,
        order: 13,
      },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: publicItemId, order: 0 },
    });

    // Accessible without token (it's public)
    const detail = await getPublicPlaylist(playlist.id);
    expect(detail).not.toBeNull();
  });

  it("reflects item visibility changes at read time", async () => {
    const playlist = await prisma.playlist.create({
      data: {
        name: "Dynamic Vis",
        userId: testUserId,
        isPublic: true,
        order: 4,
      },
    });
    // Start with a public item
    const toggleItem = await prisma.item.create({
      data: { name: "Toggle Item", userId: testUserId, isPublic: true },
    });
    await prisma.playlistItem.create({
      data: { playlistId: playlist.id, itemId: toggleItem.id, order: 0 },
    });

    // Should be visible
    let detail = await getPublicPlaylist(playlist.id);
    expect(detail).not.toBeNull();
    expect(detail!.items).toHaveLength(1);

    // Make item private
    await prisma.item.update({
      where: { id: toggleItem.id },
      data: { isPublic: false },
    });

    // Should now be hidden (playlist has no public items)
    detail = await getPublicPlaylist(playlist.id);
    expect(detail).toBeNull();

    // Cleanup
    await prisma.item.delete({ where: { id: toggleItem.id } });
  });
});
