import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    playlist: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/shelf-query-utils", () => ({
  getSystemShelfItems: vi.fn(),
  getUserPlaylistShelfItems: vi.fn(),
}));
vi.mock("@/lib/system-playlists", () => ({
  ensureSystemPlaylists: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSystemShelfItems,
  getUserPlaylistShelfItems,
} from "@/lib/shelf-query-utils";
import {
  getHomeShelves,
  getShelfConfig,
  addPlaylistAsShelf,
  removeShelf,
  reorderShelves,
} from "@/lib/shelf-actions";
import { ensureSystemPlaylists } from "@/lib/system-playlists";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockGetSystemShelfItems = getSystemShelfItems as ReturnType<typeof vi.fn>;
const mockGetUserPlaylistShelfItems = getUserPlaylistShelfItems as ReturnType<
  typeof vi.fn
>;
const mockEnsureSystemPlaylists = ensureSystemPlaylists as ReturnType<
  typeof vi.fn
>;
const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  playlist: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockEnsureSystemPlaylists.mockResolvedValue(undefined);
});

describe("getHomeShelves", () => {
  it("returns empty array for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getHomeShelves();
    expect(result).toEqual([]);
  });

  it("returns empty array when no shelves configured", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    const result = await getHomeShelves();
    expect(result).toEqual([]);
  });

  it("returns a system playlist shelf with resolved items", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "sys-1",
        name: "Recently Added",
        systemType: "RECENTLY_ADDED",
        shelfOrder: 1,
      },
    ]);

    mockGetSystemShelfItems.mockResolvedValue([
      {
        id: "item-a",
        name: "Movie A",
        tmdbPosterPath: null,
        artworkId: null,
        childCount: 0,
        playbackProgress: null,
      },
      {
        id: "item-b",
        name: "Movie B",
        tmdbPosterPath: "/poster.jpg",
        artworkId: null,
        childCount: 0,
        playbackProgress: 40,
      },
    ]);

    const result = await getHomeShelves();

    expect(result).toHaveLength(1);
    expect(result[0].playlistId).toBe("sys-1");
    expect(result[0].name).toBe("Recently Added");
    expect(result[0].type).toBe("RECENTLY_ADDED");
    expect(result[0].items).toHaveLength(2);
    expect(result[0].items[0].id).toBe("item-a");
    expect(result[0].items[0].name).toBe("Movie A");
    expect(result[0].items[1].playbackProgress).toBe(40);
  });

  it("returns a user playlist shelf with resolved items", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "user-pl-1",
        name: "Favourites",
        systemType: null,
        shelfOrder: 2,
      },
    ]);

    mockGetUserPlaylistShelfItems.mockResolvedValue([
      {
        id: "item-x",
        name: "Film X",
        tmdbPosterPath: null,
        artworkId: "art-1",
        childCount: 0,
        playbackProgress: null,
      },
      {
        id: "item-y",
        name: "Film Y",
        tmdbPosterPath: null,
        artworkId: null,
        childCount: 3,
        playbackProgress: null,
      },
    ]);

    const result = await getHomeShelves();

    expect(result).toHaveLength(1);
    expect(result[0].playlistId).toBe("user-pl-1");
    expect(result[0].name).toBe("Favourites");
    expect(result[0].type).toBeNull();
    expect(result[0].items).toHaveLength(2);
    expect(result[0].items[0].name).toBe("Film X");
    expect(result[0].items[1].name).toBe("Film Y");
  });

  it("filters out empty shelves while keeping populated ones", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "sys-ra",
        name: "Recently Added",
        systemType: "RECENTLY_ADDED",
        shelfOrder: 1,
      },
      {
        id: "sys-wa",
        name: "Watch Again",
        systemType: "WATCH_AGAIN",
        shelfOrder: 2,
      },
    ]);

    // RECENTLY_ADDED returns items
    mockGetSystemShelfItems
      .mockResolvedValueOnce([
        {
          id: "item-1",
          name: "Movie 1",
          tmdbPosterPath: null,
          artworkId: null,
          childCount: 0,
          playbackProgress: null,
        },
      ])
      // WATCH_AGAIN returns empty
      .mockResolvedValueOnce([]);

    const result = await getHomeShelves();

    expect(result).toHaveLength(1);
    expect(result[0].playlistId).toBe("sys-ra");
    expect(result[0].name).toBe("Recently Added");
  });

  it("returns shelves in shelfOrder order", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "shelf-A",
        name: "Shelf A",
        systemType: "RECENTLY_ADDED",
        shelfOrder: 1,
      },
      {
        id: "shelf-B",
        name: "Shelf B",
        systemType: null,
        shelfOrder: 3,
      },
    ]);

    mockGetSystemShelfItems.mockResolvedValue([
      {
        id: "item-ra",
        name: "RA Movie",
        tmdbPosterPath: null,
        artworkId: null,
        childCount: 0,
        playbackProgress: null,
      },
    ]);

    mockGetUserPlaylistShelfItems.mockResolvedValue([
      {
        id: "item-custom",
        name: "Custom Movie",
        tmdbPosterPath: null,
        artworkId: null,
        childCount: 0,
        playbackProgress: null,
      },
    ]);

    const result = await getHomeShelves();

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Shelf A");
    expect(result[1].name).toBe("Shelf B");
  });

  it("calls ensureSystemPlaylists before fetching shelves", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);

    await getHomeShelves();

    expect(mockEnsureSystemPlaylists).toHaveBeenCalledWith("user-1");
    expect(mockEnsureSystemPlaylists).toHaveBeenCalledBefore(
      mockPrisma.playlist.findMany
    );
  });

  it("dispatches system playlist types to getSystemShelfItems", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "cw-1",
        name: "Continue Watching",
        systemType: "CONTINUE_WATCHING",
        shelfOrder: 1,
      },
    ]);

    mockGetSystemShelfItems.mockResolvedValue([]);

    await getHomeShelves();

    expect(mockGetSystemShelfItems).toHaveBeenCalledWith(
      "user-1",
      "CONTINUE_WATCHING"
    );
  });

  it("dispatches user playlists to getUserPlaylistShelfItems", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "user-pl-1",
        name: "My List",
        systemType: null,
        shelfOrder: 1,
      },
    ]);

    mockGetUserPlaylistShelfItems.mockResolvedValue([]);

    await getHomeShelves();

    expect(mockGetUserPlaylistShelfItems).toHaveBeenCalledWith("user-pl-1");
  });
});

describe("getShelfConfig", () => {
  it("returns all playlists with their shelfOrder", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Continue Watching",
        systemType: "CONTINUE_WATCHING",
        shelfOrder: 1,
      },
      {
        id: "p2",
        name: "My Custom List",
        systemType: null,
        shelfOrder: null,
      },
    ]);

    const result = await getShelfConfig();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].playlistId).toBe("p1");
      expect(result.data[0].shelfOrder).toBe(1);
      expect(result.data[1].shelfOrder).toBeNull();
    }
  });

  it("returns error for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getShelfConfig();
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });
});

describe("addPlaylistAsShelf", () => {
  it("sets shelfOrder on a playlist", async () => {
    mockPrisma.playlist.findFirst.mockResolvedValue({
      id: "p1",
      userId: "user-1",
    });
    mockPrisma.playlist.findMany.mockResolvedValue([{ shelfOrder: 5 }]);
    mockPrisma.playlist.update.mockResolvedValue({});

    const result = await addPlaylistAsShelf("p1");
    expect(result.success).toBe(true);
    expect(mockPrisma.playlist.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { shelfOrder: 6 },
    });
  });

  it("returns error for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await addPlaylistAsShelf("p1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error when playlist not found", async () => {
    mockPrisma.playlist.findFirst.mockResolvedValue(null);
    const result = await addPlaylistAsShelf("p1");
    expect(result).toEqual({ success: false, error: "Playlist not found" });
  });
});

describe("removeShelf", () => {
  it("sets shelfOrder to null", async () => {
    mockPrisma.playlist.findFirst.mockResolvedValue({
      id: "p1",
      userId: "user-1",
    });
    mockPrisma.playlist.update.mockResolvedValue({});

    const result = await removeShelf("p1");
    expect(result.success).toBe(true);
    expect(mockPrisma.playlist.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { shelfOrder: null },
    });
  });

  it("returns error for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await removeShelf("p1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error when playlist not found", async () => {
    mockPrisma.playlist.findFirst.mockResolvedValue(null);
    const result = await removeShelf("p1");
    expect(result).toEqual({ success: false, error: "Playlist not found" });
  });
});

describe("reorderShelves", () => {
  it("updates shelfOrder for each playlist via $transaction", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
      { id: "p3" },
    ]);
    mockPrisma.$transaction.mockResolvedValue([{}, {}, {}]);

    const result = await reorderShelves(["p1", "p2", "p3"]);
    expect(result.success).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns error for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await reorderShelves(["p1"]);
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error for empty array", async () => {
    const result = await reorderShelves([]);
    expect(result).toEqual({ success: false, error: "Invalid shelf order" });
  });

  it("returns error when a playlist ID is not owned by user", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([{ id: "p1" }]);
    const result = await reorderShelves(["p1", "p2"]);
    expect(result).toEqual({
      success: false,
      error: "One or more playlists not found",
    });
  });
});

describe("ensureSystemPlaylists", () => {
  // Re-mock prisma for ensureSystemPlaylists tests since it uses different methods
  // ensureSystemPlaylists is imported from system-playlists but we test via the mock
  // To test the real logic, we need the unmocked version
  // However since we already mock system-playlists above, we test it in a separate file
  // These tests verify the mock integration in getHomeShelves
  it("is called by getHomeShelves for authenticated users", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);

    await getHomeShelves();

    expect(mockEnsureSystemPlaylists).toHaveBeenCalledWith("user-1");
  });

  it("is not called when user is unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);

    await getHomeShelves();

    expect(mockEnsureSystemPlaylists).not.toHaveBeenCalled();
  });
});
