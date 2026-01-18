/**
 * Integration tests for item-based progress calculation.
 * Tests progress aggregation across item hierarchies with real database.
 * Progress tracks items with watched primary media (>= 90% complete).
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
import type { Session } from "next-auth";
import { getItems, getLibraryProgress } from "@/lib/item-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock auth to return our test user
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";

// Cast to bypass complex next-auth types
const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

// Use unique ID per test run to avoid conflicts
const TEST_USER_ID = `test-progress-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `progress-${Date.now()}@test.example.com`;

// Create test user once for all describe blocks
beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      passwordHash: "hashed",
    },
  });
});

// Clean up after all describe blocks complete
afterAll(async () => {
  await prisma.itemFile.deleteMany({
    where: { item: { userId: TEST_USER_ID } },
  });
  await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

describe("item progress integration", () => {
  beforeEach(() => {
    // Mock auth to return test user for each test
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  it("returns null progress for item with no primary media", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Empty Folder",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    const foundItem = result.data.find((i) => i.id === item.id);
    expect(foundItem?.progress).toBeNull();

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("returns 0% progress for unwatched primary media", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Unwatched Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: null,
            isPrimary: true,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    const foundItem = result.data.find((i) => i.id === item.id);
    expect(foundItem?.progress?.percentage).toBe(0);
    expect(foundItem?.progress?.watchedItems).toBe(0);
    expect(foundItem?.progress?.itemsWithMedia).toBe(1);
    expect(foundItem?.progress?.totalItems).toBe(1);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("returns 100% progress for watched primary media", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Watched Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: 6600, // 91.6% - above 90% threshold
            isPrimary: true,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    const foundItem = result.data.find((i) => i.id === item.id);
    expect(foundItem?.progress?.percentage).toBe(100);
    expect(foundItem?.progress?.watchedItems).toBe(1);
    expect(foundItem?.progress?.itemsWithMedia).toBe(1);
    expect(foundItem?.progress?.totalItems).toBe(1);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("aggregates progress across descendants", async () => {
    // Create show with 2 episodes
    const show = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    // Episode 1 - watched
    const ep1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: TEST_USER_ID,
        parentId: show.id,
        order: 0,
        depth: 1,
        files: {
          create: {
            filename: "ep1.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 3600,
            playbackPosition: 3300, // 91.6% - complete
            isPrimary: true,
          },
        },
      },
    });

    // Episode 2 - not watched
    const ep2 = await prisma.item.create({
      data: {
        name: "Episode 2",
        userId: TEST_USER_ID,
        parentId: show.id,
        order: 1,
        depth: 1,
        files: {
          create: {
            filename: "ep2.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 3600,
            playbackPosition: 0,
            isPrimary: true,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    // Show should have 50% progress (1/2 items watched, 3 total items)
    const foundShow = result.data.find((i) => i.id === show.id);
    expect(foundShow?.progress?.percentage).toBe(50);
    expect(foundShow?.progress?.watchedItems).toBe(1);
    expect(foundShow?.progress?.itemsWithMedia).toBe(2);
    expect(foundShow?.progress?.totalItems).toBe(3); // show + 2 episodes

    // Cleanup
    await prisma.itemFile.deleteMany({
      where: { itemId: { in: [ep1.id, ep2.id] } },
    });
    await prisma.item.deleteMany({
      where: { id: { in: [ep1.id, ep2.id, show.id] } },
    });
  });

  it("handles deeply nested hierarchies", async () => {
    // Create: TV Show > Season 1 > Episode 1 (watched)
    const tvShow = await prisma.item.create({
      data: {
        name: "Nested TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const season = await prisma.item.create({
      data: {
        name: "Season 1",
        userId: TEST_USER_ID,
        parentId: tvShow.id,
        order: 0,
        depth: 1,
      },
    });

    const episode = await prisma.item.create({
      data: {
        name: "S01E01",
        userId: TEST_USER_ID,
        parentId: season.id,
        order: 0,
        depth: 2,
        files: {
          create: {
            filename: "s01e01.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 3600,
            playbackPosition: 3500, // 97% - complete
            isPrimary: true,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    // TV Show should see the watched item from its grandchild
    const foundShow = result.data.find((i) => i.id === tvShow.id);
    expect(foundShow?.progress?.percentage).toBe(100);
    expect(foundShow?.progress?.watchedItems).toBe(1);
    expect(foundShow?.progress?.itemsWithMedia).toBe(1);
    expect(foundShow?.progress?.totalItems).toBe(3); // show + season + episode

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: episode.id } });
    await prisma.item.deleteMany({
      where: { id: { in: [episode.id, season.id, tvShow.id] } },
    });
  });

  it("only counts primary media file, ignores non-primary and non-media files", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie With Trailer And Extras",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
        files: {
          create: [
            {
              filename: "movie.mkv",
              fileType: "MEDIA",
              mimeType: "video/x-matroska",
              playbackDuration: 7200,
              playbackPosition: 6600, // complete (91.6%)
              isPrimary: true, // Primary media - this counts
            },
            {
              filename: "trailer.mp4",
              fileType: "MEDIA",
              mimeType: "video/mp4",
              playbackDuration: 120,
              playbackPosition: 0, // Not watched, but doesn't matter
              isPrimary: false, // Non-primary - ignored
            },
            {
              filename: "poster.jpg",
              fileType: "ARTWORK",
              mimeType: "image/jpeg",
            },
            {
              filename: "subtitles.srt",
              fileType: "SUBTITLE",
              mimeType: "application/x-subrip",
            },
          ],
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    // Only the primary media file counts - item is watched
    const foundItem = result.data.find((i) => i.id === item.id);
    expect(foundItem?.progress?.watchedItems).toBe(1);
    expect(foundItem?.progress?.itemsWithMedia).toBe(1);
    expect(foundItem?.progress?.totalItems).toBe(1);
    expect(foundItem?.progress?.percentage).toBe(100);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("handles partially watched primary media (below 90% threshold)", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Partially Watched",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: 3600, // 50% - not complete
            isPrimary: true,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    const foundItem = result.data.find((i) => i.id === item.id);
    expect(foundItem?.progress?.percentage).toBe(0);
    expect(foundItem?.progress?.watchedItems).toBe(0);
    expect(foundItem?.progress?.itemsWithMedia).toBe(1);
    expect(foundItem?.progress?.totalItems).toBe(1);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("counts items without primary media in totalItems but not itemsWithMedia", async () => {
    // Create folder with one item that has media and one without
    const folder = await prisma.item.create({
      data: {
        name: "Mixed Folder",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    // Item with watched primary media
    const movieItem = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        parentId: folder.id,
        order: 0,
        depth: 1,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: 6600, // watched
            isPrimary: true,
          },
        },
      },
    });

    // Empty folder (no media)
    const emptyFolder = await prisma.item.create({
      data: {
        name: "Empty Subfolder",
        userId: TEST_USER_ID,
        parentId: folder.id,
        order: 1,
        depth: 1,
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    if (!result.success || !result.data) throw new Error("Expected success");

    // Folder should show: 1/1 watched (of 3 items)
    const foundFolder = result.data.find((i) => i.id === folder.id);
    expect(foundFolder?.progress?.watchedItems).toBe(1);
    expect(foundFolder?.progress?.itemsWithMedia).toBe(1);
    expect(foundFolder?.progress?.totalItems).toBe(3); // folder + movie + empty subfolder
    expect(foundFolder?.progress?.percentage).toBe(100);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: movieItem.id } });
    await prisma.item.deleteMany({
      where: { id: { in: [movieItem.id, emptyFolder.id, folder.id] } },
    });
  });
});

describe("getLibraryProgress", () => {
  beforeEach(async () => {
    // Clean up any items from previous tests to ensure isolation
    await prisma.itemFile.deleteMany({
      where: { item: { userId: TEST_USER_ID } },
    });
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });

    // Mock auth to return test user for each test
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  it("returns progress with null percentage when user has no items with primary media", async () => {
    // Create item without primary media files
    const item = await prisma.item.create({
      data: {
        name: "Empty Item",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const progress = await getLibraryProgress();
    expect(progress).not.toBeNull();
    expect(progress?.itemsWithMedia).toBe(0);
    expect(progress?.watchedItems).toBe(0);
    expect(progress?.totalItems).toBe(1);
    expect(progress?.percentage).toBeNull();

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("returns null when user has no items at all", async () => {
    // No items - beforeEach already cleaned up
    const progress = await getLibraryProgress();
    expect(progress).toBeNull();
  });

  it("returns library-wide progress across all items with primary media", async () => {
    // Create multiple items with primary media files
    const movie1 = await prisma.item.create({
      data: {
        name: "Movie 1",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie1.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: 6600, // complete (91.6%)
            isPrimary: true,
          },
        },
      },
    });

    const movie2 = await prisma.item.create({
      data: {
        name: "Movie 2",
        userId: TEST_USER_ID,
        order: 1,
        depth: 0,
        files: {
          create: {
            filename: "movie2.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: 0, // not started
            isPrimary: true,
          },
        },
      },
    });

    const progress = await getLibraryProgress();
    expect(progress).not.toBeNull();
    expect(progress?.itemsWithMedia).toBe(2);
    expect(progress?.watchedItems).toBe(1);
    expect(progress?.totalItems).toBe(2);
    expect(progress?.percentage).toBe(50);

    // Cleanup
    await prisma.itemFile.deleteMany({
      where: { itemId: { in: [movie1.id, movie2.id] } },
    });
    await prisma.item.deleteMany({
      where: { id: { in: [movie1.id, movie2.id] } },
    });
  });

  it("includes nested items in library totals", async () => {
    // Create parent with child containing primary media
    const parent = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const episode = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 0,
        depth: 1,
        files: {
          create: {
            filename: "ep1.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 3600,
            playbackPosition: 3300, // complete
            isPrimary: true,
          },
        },
      },
    });

    const progress = await getLibraryProgress();
    expect(progress).not.toBeNull();
    expect(progress?.itemsWithMedia).toBe(1);
    expect(progress?.watchedItems).toBe(1);
    expect(progress?.totalItems).toBe(2); // parent + episode
    expect(progress?.percentage).toBe(100);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: episode.id } });
    await prisma.item.deleteMany({
      where: { id: { in: [episode.id, parent.id] } },
    });
  });

  it("only counts primary media files, ignores non-primary and non-media files", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Item With Mixed Files",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
        files: {
          create: [
            {
              filename: "movie.mkv",
              fileType: "MEDIA",
              mimeType: "video/x-matroska",
              playbackDuration: 7200,
              playbackPosition: 6600,
              isPrimary: true,
            },
            {
              filename: "trailer.mp4",
              fileType: "MEDIA",
              mimeType: "video/mp4",
              playbackDuration: 120,
              playbackPosition: 0,
              isPrimary: false,
            },
            {
              filename: "poster.jpg",
              fileType: "ARTWORK",
              mimeType: "image/jpeg",
            },
          ],
        },
      },
    });

    const progress = await getLibraryProgress();
    expect(progress?.itemsWithMedia).toBe(1); // Only primary media counts
    expect(progress?.watchedItems).toBe(1);
    expect(progress?.totalItems).toBe(1);

    // Cleanup
    await prisma.itemFile.deleteMany({ where: { itemId: item.id } });
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("returns null for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);

    const progress = await getLibraryProgress();
    expect(progress).toBeNull();
  });
});
