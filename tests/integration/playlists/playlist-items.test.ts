/**
 * Integration tests for playlist item operations.
 * Tests add, remove, bulk remove, reorder, and membership queries.
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
  addItemToPlaylists,
  removeItemFromPlaylist,
  removeItemsFromPlaylist,
  reorderPlaylistItems,
  getPlaylistsForItem,
} from "@/lib/playlist-actions";

const TEST_EMAIL = `playlist-items-${Date.now()}@test.example.com`;
let testUserId: string;
let testItemIds: string[];

describe("playlist items integration", () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: TEST_EMAIL, passwordHash: "hashed" },
    });
    testUserId = user.id;

    // Create test items
    const items = await Promise.all(
      ["Item A", "Item B", "Item C"].map((name) =>
        prisma.item.create({ data: { name, userId: testUserId } })
      )
    );
    testItemIds = items.map((i) => i.id);
  });

  beforeEach(() => {
    currentTestUserId = testUserId;
  });

  afterAll(async () => {
    await prisma.playlistItem.deleteMany({
      where: { playlist: { userId: testUserId } },
    });
    await prisma.playlist.deleteMany({ where: { userId: testUserId } });
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  it("adds item to playlist", async () => {
    const create = await createPlaylist("Add Test");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    const add = await addItemToPlaylists(testItemIds[0], [create.data!.id]);
    expect(add.success).toBe(true);

    const get = await getPlaylist(create.data!.id);
    expect(get.success).toBe(true);
    if (!get.success) throw new Error("Failed");
    expect(get.data!.items).toHaveLength(1);
    expect(get.data!.items[0].item.id).toBe(testItemIds[0]);
  });

  it("is idempotent when adding same item twice", async () => {
    const create = await createPlaylist("Idempotent Test");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    await addItemToPlaylists(testItemIds[0], [create.data!.id]);
    const add2 = await addItemToPlaylists(testItemIds[0], [create.data!.id]);
    expect(add2.success).toBe(true);

    const get = await getPlaylist(create.data!.id);
    expect(get.success).toBe(true);
    if (!get.success) throw new Error("Failed");
    expect(get.data!.items).toHaveLength(1);
  });

  it("removes item from playlist", async () => {
    const create = await createPlaylist("Remove Test");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    await addItemToPlaylists(testItemIds[0], [create.data!.id]);
    const remove = await removeItemFromPlaylist(
      create.data!.id,
      testItemIds[0]
    );
    expect(remove.success).toBe(true);

    const get = await getPlaylist(create.data!.id);
    expect(get.success).toBe(true);
    if (!get.success) throw new Error("Failed");
    expect(get.data!.items).toHaveLength(0);
  });

  it("bulk removes items", async () => {
    const create = await createPlaylist("Bulk Remove");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    await addItemToPlaylists(testItemIds[0], [create.data!.id]);
    await addItemToPlaylists(testItemIds[1], [create.data!.id]);
    await addItemToPlaylists(testItemIds[2], [create.data!.id]);

    const remove = await removeItemsFromPlaylist(create.data!.id, [
      testItemIds[0],
      testItemIds[1],
    ]);
    expect(remove.success).toBe(true);

    const get = await getPlaylist(create.data!.id);
    expect(get.success).toBe(true);
    if (!get.success) throw new Error("Failed");
    expect(get.data!.items).toHaveLength(1);
    expect(get.data!.items[0].item.id).toBe(testItemIds[2]);
  });

  it("reorders items within playlist", async () => {
    const create = await createPlaylist("Reorder Items");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    await addItemToPlaylists(testItemIds[0], [create.data!.id]);
    await addItemToPlaylists(testItemIds[1], [create.data!.id]);

    const get1 = await getPlaylist(create.data!.id);
    if (!get1.success) throw new Error("Failed");

    // Swap order
    await reorderPlaylistItems(create.data!.id, [
      { id: get1.data!.items[0].playlistItemId, order: 10 },
      { id: get1.data!.items[1].playlistItemId, order: 0 },
    ]);

    const get2 = await getPlaylist(create.data!.id);
    if (!get2.success) throw new Error("Failed");
    expect(get2.data!.items[0].item.id).toBe(testItemIds[1]);
    expect(get2.data!.items[1].item.id).toBe(testItemIds[0]);
  });

  it("getPlaylistsForItem returns correct memberships", async () => {
    const p1 = await createPlaylist("Membership A");
    const p2 = await createPlaylist("Membership B");
    expect(p1.success && p2.success).toBe(true);
    if (!p1.success || !p2.success) throw new Error("Failed");

    await addItemToPlaylists(testItemIds[0], [p1.data!.id]);

    const memberships = await getPlaylistsForItem(testItemIds[0]);
    expect(memberships.success).toBe(true);
    if (!memberships.success) throw new Error("Failed");

    const m1 = memberships.data!.find((m) => m.id === p1.data!.id);
    const m2 = memberships.data!.find((m) => m.id === p2.data!.id);
    expect(m1?.isMember).toBe(true);
    expect(m2?.isMember).toBe(false);
  });

  it("cascades when source item is deleted", async () => {
    const create = await createPlaylist("Cascade Test");
    expect(create.success).toBe(true);
    if (!create.success) throw new Error("Failed");

    const tempItem = await prisma.item.create({
      data: { name: "Temp Item", userId: testUserId },
    });
    await addItemToPlaylists(tempItem.id, [create.data!.id]);

    // Delete the item
    await prisma.item.delete({ where: { id: tempItem.id } });

    // Playlist should still exist but item reference is gone
    const get = await getPlaylist(create.data!.id);
    expect(get.success).toBe(true);
    if (!get.success) throw new Error("Failed");
    expect(get.data!.items).toHaveLength(0);
  });
});
