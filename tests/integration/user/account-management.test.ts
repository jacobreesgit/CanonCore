/**
 * Integration tests for account deletion and data export.
 * Tests with real database to verify cascade deletion and export completeness.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { hash } from "bcryptjs";
import { deleteAccount, exportAccountData } from "@/lib/user-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/server for `after` (runs callback synchronously in tests)
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((fn: () => void) => fn()),
  };
});

// Mock google-drive-client (deleteAccount imports it)
vi.mock("@/lib/google-drive-client", () => ({
  getDriveClient: vi.fn(),
  withRateLimit: vi.fn((fn: () => unknown) => fn()),
}));

vi.stubEnv("BYPASS_RATE_LIMIT", "true");

let currentTestUserId: string | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        currentTestUserId ? { user: { id: currentTestUserId } } : null
      )
    ),
}));

async function createFullTestUser(suffix: string) {
  const email = `account-mgmt-${Date.now()}-${suffix}@test.example.com`;
  const passwordHash = await hash("Password1", 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Test User",
      username: `testuser${Date.now()}`,
      passwordHash,
    },
  });

  const item = await prisma.item.create({
    data: {
      name: "Test Item",
      description: "A test item",
      userId: user.id,
      isPublic: true,
      tmdbId: 123,
      tmdbType: "movie",
    },
  });

  const playlist = await prisma.playlist.create({
    data: {
      name: "Test Playlist",
      description: "A test playlist",
      userId: user.id,
    },
  });

  await prisma.playlistItem.create({
    data: {
      playlistId: playlist.id,
      itemId: item.id,
      order: 0,
    },
  });

  currentTestUserId = user.id;
  return { user, item, playlist };
}

describe("deleteAccount integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("cascades deletion of all related records", async () => {
    const { user, item, playlist } = await createFullTestUser("cascade");

    const result = await deleteAccount("Password1", "DELETE");
    expect(result.success).toBe(true);

    // Verify all records deleted
    const deletedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(deletedUser).toBeNull();

    const deletedItem = await prisma.item.findUnique({
      where: { id: item.id },
    });
    expect(deletedItem).toBeNull();

    const deletedPlaylist = await prisma.playlist.findUnique({
      where: { id: playlist.id },
    });
    expect(deletedPlaylist).toBeNull();

    const playlistItems = await prisma.playlistItem.findMany({
      where: { playlistId: playlist.id },
    });
    expect(playlistItems).toHaveLength(0);
  });

  it("does not affect other users' data", async () => {
    // Create two users
    const { user: userToDelete } = await createFullTestUser("delete-me");
    const {
      user: otherUser,
      item: otherItem,
      playlist: otherPlaylist,
    } = await createFullTestUser("keep-me");

    // Switch auth context to the user being deleted
    currentTestUserId = userToDelete.id;

    const result = await deleteAccount("Password1", "DELETE");
    expect(result.success).toBe(true);

    // Verify deleted user is gone
    const deletedUser = await prisma.user.findUnique({
      where: { id: userToDelete.id },
    });
    expect(deletedUser).toBeNull();

    // Verify other user's data is intact
    const keptUser = await prisma.user.findUnique({
      where: { id: otherUser.id },
    });
    expect(keptUser).not.toBeNull();

    const keptItem = await prisma.item.findUnique({
      where: { id: otherItem.id },
    });
    expect(keptItem).not.toBeNull();

    const keptPlaylist = await prisma.playlist.findUnique({
      where: { id: otherPlaylist.id },
    });
    expect(keptPlaylist).not.toBeNull();

    // Cleanup other user
    await prisma.playlistItem
      .deleteMany({ where: { playlist: { userId: otherUser.id } } })
      .catch(() => {});
    await prisma.playlist
      .deleteMany({ where: { userId: otherUser.id } })
      .catch(() => {});
    await prisma.item
      .deleteMany({ where: { userId: otherUser.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: otherUser.id } }).catch(() => {});
  });
});

describe("exportAccountData integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("exports full library data", async () => {
    const { user } = await createFullTestUser("export");

    const result = await exportAccountData();
    expect(result.success).toBe(true);

    if (result.success && result.data) {
      expect(result.data.user.email).toContain("account-mgmt");
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].name).toBe("Test Item");
      expect(result.data.items[0].tmdbId).toBe(123);
      expect(result.data.playlists).toHaveLength(1);
      expect(result.data.playlists[0].name).toBe("Test Playlist");
      expect(result.data.playlists[0].items).toHaveLength(1);
      expect(result.data.playlists[0].items[0].itemName).toBe("Test Item");
    }

    // Cleanup
    await prisma.playlistItem
      .deleteMany({ where: { playlist: { userId: user.id } } })
      .catch(() => {});
    await prisma.playlist
      .deleteMany({ where: { userId: user.id } })
      .catch(() => {});
    await prisma.item
      .deleteMany({ where: { userId: user.id } })
      .catch(() => {});
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
  });
});
