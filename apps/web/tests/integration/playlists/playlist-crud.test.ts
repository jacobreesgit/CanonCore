/**
 * Integration tests for playlist CRUD operations.
 * Tests with real database.
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
  getPlaylist,
  getUserPlaylists,
  updatePlaylist,
  deletePlaylist,
  reorderPlaylists,
} from "@/lib/playlist-actions";

const TEST_EMAIL = `playlist-crud-${Date.now()}@test.example.com`;
let testUserId: string;

describe("playlist CRUD integration", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        passwordHash: "hashed",
      },
    });
    testUserId = user.id;
  });

  beforeEach(() => {
    currentTestUserId = testUserId;
  });

  afterAll(async () => {
    await prisma.playlist.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it("creates a playlist and retrieves it", async () => {
    const result = await createPlaylist("Test Playlist");
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Failed");

    const getResult = await getPlaylist(result.data!.id);
    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed");
    expect(getResult.data!.name).toBe("Test Playlist");
    expect(getResult.data!.items).toHaveLength(0);
  });

  it("assigns incrementing order values", async () => {
    const r1 = await createPlaylist("First");
    const r2 = await createPlaylist("Second");
    expect(r1.success && r2.success).toBe(true);

    const list = await getUserPlaylists();
    expect(list.success).toBe(true);
    if (!list.success) throw new Error("Failed");

    const names = list.data!.map((p) => p.name);
    expect(names).toContain("First");
    expect(names).toContain("Second");

    const first = list.data!.find((p) => p.name === "First")!;
    const second = list.data!.find((p) => p.name === "Second")!;
    expect(second.order).toBeGreaterThan(first.order);
  });

  it("updates playlist name and description", async () => {
    const create = await createPlaylist("Original");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    const update = await updatePlaylist(create.data!.id, {
      name: "Renamed",
      description: "A description",
    });
    expect(update.success).toBe(true);

    const get = await getPlaylist(create.data!.id);
    expect(get.success).toBe(true);
    if (!get.success) throw new Error("Failed");
    expect(get.data!.name).toBe("Renamed");
    expect(get.data!.description).toBe("A description");
  });

  it("deletes playlist and cascades to PlaylistItem", async () => {
    const create = await createPlaylist("To Delete");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    // Create a test item and add to playlist
    const item = await prisma.item.create({
      data: { name: "Test Item", userId: testUserId },
    });
    await prisma.playlistItem.create({
      data: { playlistId: create.data!.id, itemId: item.id, order: 0 },
    });

    const deleteResult = await deletePlaylist(create.data!.id);
    expect(deleteResult.success).toBe(true);

    // PlaylistItem should be gone
    const remaining = await prisma.playlistItem.findMany({
      where: { playlistId: create.data!.id },
    });
    expect(remaining).toHaveLength(0);

    // Item should still exist
    const itemStill = await prisma.item.findUnique({
      where: { id: item.id },
    });
    expect(itemStill).not.toBeNull();

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("reorders playlists", async () => {
    const r1 = await createPlaylist("Reorder A");
    const r2 = await createPlaylist("Reorder B");
    expect(r1.success && r2.success).toBe(true);
    if (!r1.success || !r2.success) throw new Error("Failed");

    // Swap order
    await reorderPlaylists([
      { id: r1.data!.id, order: 99 },
      { id: r2.data!.id, order: 0 },
    ]);

    const list = await getUserPlaylists();
    expect(list.success).toBe(true);
    if (!list.success) throw new Error("Failed");

    const a = list.data!.find((p) => p.name === "Reorder A")!;
    const b = list.data!.find((p) => p.name === "Reorder B")!;
    expect(b.order).toBeLessThan(a.order);
  });
});
