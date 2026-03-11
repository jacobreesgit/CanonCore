import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    item: { findMany: vi.fn() },
    itemFile: { findMany: vi.fn() },
    playlist: { findFirst: vi.fn() },
    playlistItem: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/tmdb-image-utils", () => ({
  resolveArtworkId: vi.fn((item: { tmdbPosterPath: string | null }) =>
    item.tmdbPosterPath ? null : "artwork-fallback"
  ),
}));

import { prisma } from "@/lib/prisma";
import { getSystemShelfItems } from "@/lib/shelf-query-utils";
import type { SystemPlaylistType } from "@prisma/client";

const mockPrisma = prisma as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
  item: { findMany: ReturnType<typeof vi.fn> };
  itemFile: { findMany: ReturnType<typeof vi.fn> };
  playlist: { findFirst: ReturnType<typeof vi.fn> };
  playlistItem: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

/** Build a mock item row as returned by resolveShelfItems' item.findMany */
function mockItemRow(
  id: string,
  name: string,
  opts?: { tmdbPosterPath?: string | null; childCount?: number }
) {
  return {
    id,
    name,
    tmdbPosterPath: opts?.tmdbPosterPath ?? null,
    files: [],
    _count: { children: opts?.childCount ?? 0 },
  };
}

describe("getSystemShelfItems", () => {
  it("dispatches CONTINUE_WATCHING to $queryRaw", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "resume-1" }]);
    mockPrisma.item.findMany.mockResolvedValue([
      mockItemRow("resume-1", "Resumable Movie"),
    ]);
    mockPrisma.itemFile.findMany.mockResolvedValue([]);

    const items = await getSystemShelfItems(
      "user-1",
      "CONTINUE_WATCHING" as SystemPlaylistType
    );

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("resume-1");
    expect(items[0].name).toBe("Resumable Movie");
  });

  it("dispatches WATCHLIST correctly", async () => {
    mockPrisma.playlist.findFirst.mockResolvedValue({
      id: "wl-1",
      systemType: "WATCHLIST",
      playlistItems: [{ itemId: "wl-item-1" }],
    });
    mockPrisma.item.findMany.mockResolvedValue([
      mockItemRow("wl-item-1", "Watchlist Movie"),
    ]);
    mockPrisma.itemFile.findMany.mockResolvedValue([]);

    const items = await getSystemShelfItems(
      "user-1",
      "WATCHLIST" as SystemPlaylistType
    );

    expect(mockPrisma.playlist.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", systemType: "WATCHLIST" },
      })
    );
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Watchlist Movie");
  });

  it("dispatches RECENTLY_ADDED correctly", async () => {
    mockPrisma.item.findMany
      .mockResolvedValueOnce([{ id: "new-1" }, { id: "new-2" }])
      .mockResolvedValueOnce([
        mockItemRow("new-1", "New Film 1"),
        mockItemRow("new-2", "New Film 2"),
      ]);
    mockPrisma.itemFile.findMany.mockResolvedValue([]);

    const items = await getSystemShelfItems(
      "user-1",
      "RECENTLY_ADDED" as SystemPlaylistType
    );

    expect(items).toHaveLength(2);
    expect(items[0].name).toBe("New Film 1");
    expect(items[1].name).toBe("New Film 2");
  });

  it("dispatches WATCH_AGAIN correctly", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "rewatchable-1" }]);
    mockPrisma.item.findMany.mockResolvedValue([
      mockItemRow("rewatchable-1", "Rewatchable Film"),
    ]);
    mockPrisma.itemFile.findMany.mockResolvedValue([]);

    const items = await getSystemShelfItems(
      "user-1",
      "WATCH_AGAIN" as SystemPlaylistType
    );

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Rewatchable Film");
  });
});
