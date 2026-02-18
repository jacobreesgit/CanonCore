/**
 * Integration tests for playlist authorisation boundaries.
 * Tests that users cannot access or modify other users' playlists.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import { prisma } from "@/lib/prisma";
import "../setup";

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

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

import {
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addItemToPlaylists,
} from "@/lib/playlist-actions";

const TEST_EMAIL_1 = `playlist-auth1-${Date.now()}@test.example.com`;
const TEST_EMAIL_2 = `playlist-auth2-${Date.now()}@test.example.com`;
let user1Id: string;
let user2Id: string;

describe("playlist auth integration", () => {
  beforeAll(async () => {
    const user1 = await prisma.user.create({
      data: { email: TEST_EMAIL_1, passwordHash: "hashed" },
    });
    user1Id = user1.id;

    const user2 = await prisma.user.create({
      data: { email: TEST_EMAIL_2, passwordHash: "hashed" },
    });
    user2Id = user2.id;
  });

  beforeEach(() => {
    currentTestUserId = null;
  });

  afterAll(async () => {
    await prisma.playlistItem.deleteMany({
      where: { playlist: { userId: { in: [user1Id, user2Id] } } },
    });
    await prisma.playlist.deleteMany({
      where: { userId: { in: [user1Id, user2Id] } },
    });
    await prisma.item.deleteMany({
      where: { userId: { in: [user1Id, user2Id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user1Id, user2Id] } },
    });
  });

  it("rejects unauthenticated create", async () => {
    currentTestUserId = null;
    const result = await createPlaylist("Nope");
    expect(result.error).toBe("Not authenticated");
  });

  it("rejects unauthenticated update", async () => {
    currentTestUserId = null;
    const result = await updatePlaylist("fake-id", { name: "Nope" });
    expect(result.error).toBe("Not authenticated");
  });

  it("rejects unauthenticated delete", async () => {
    currentTestUserId = null;
    const result = await deletePlaylist("fake-id");
    expect(result.error).toBe("Not authenticated");
  });

  it("user cannot update another user's playlist", async () => {
    // User 1 creates a playlist
    currentTestUserId = user1Id;
    const create = await createPlaylist("User1 Playlist");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    // User 2 tries to update it
    currentTestUserId = user2Id;
    const update = await updatePlaylist(create.data!.id, { name: "Hacked" });
    expect(update.error).toBe("Playlist not found");
  });

  it("user cannot delete another user's playlist", async () => {
    currentTestUserId = user1Id;
    const create = await createPlaylist("User1 Delete Test");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    currentTestUserId = user2Id;
    const del = await deletePlaylist(create.data!.id);
    expect(del.error).toBe("Playlist not found");
  });

  it("user cannot add another user's items to their playlist", async () => {
    // User 1 creates an item
    const item = await prisma.item.create({
      data: { name: "User1 Item", userId: user1Id },
    });

    // User 2 creates a playlist and tries to add user1's item
    currentTestUserId = user2Id;
    const create = await createPlaylist("User2 Playlist");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    const add = await addItemToPlaylists(item.id, [create.data!.id]);
    expect(add.error).toBe("Item not found");

    await prisma.item.delete({ where: { id: item.id } });
  });
});
