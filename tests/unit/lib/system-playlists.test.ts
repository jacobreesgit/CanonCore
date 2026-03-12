import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    playlist: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { ensureSystemPlaylists } from "@/lib/system-playlists";

const mockPrisma = prisma as unknown as {
  playlist: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureSystemPlaylists", () => {
  it("creates all 4 system playlists for a new user", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    mockPrisma.playlist.createMany.mockResolvedValue({ count: 4 });

    await ensureSystemPlaylists("user-1");

    expect(mockPrisma.playlist.createMany).toHaveBeenCalledTimes(1);
    const createCall = mockPrisma.playlist.createMany.mock.calls[0][0];
    expect(createCall.data).toHaveLength(4);

    // Verify the system types
    const types = createCall.data.map(
      (d: { systemType: string }) => d.systemType
    );
    expect(types).toContain("CONTINUE_WATCHING");
    expect(types).toContain("WATCHLIST");
    expect(types).toContain("RECENTLY_ADDED");
    expect(types).toContain("WATCH_AGAIN");
  });

  it("is idempotent - skips creation when all playlists already exist", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([
      { systemType: "CONTINUE_WATCHING" },
      { systemType: "WATCHLIST" },
      { systemType: "RECENTLY_ADDED" },
      { systemType: "WATCH_AGAIN" },
    ]);

    await ensureSystemPlaylists("user-1");

    // Should not call createMany since all types exist
    expect(mockPrisma.playlist.createMany).not.toHaveBeenCalled();
  });

  it("creates playlists with correct default shelfOrder values", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    mockPrisma.playlist.createMany.mockResolvedValue({ count: 4 });

    await ensureSystemPlaylists("user-1");

    const createCall = mockPrisma.playlist.createMany.mock.calls[0][0];
    const dataByType = new Map(
      createCall.data.map(
        (d: { systemType: string; shelfOrder: number | null }) => [
          d.systemType,
          d,
        ]
      )
    );

    // CONTINUE_WATCHING and WATCHLIST have default shelf orders
    expect(
      (dataByType.get("CONTINUE_WATCHING") as { shelfOrder: number | null })
        .shelfOrder
    ).toBe(1);
    expect(
      (dataByType.get("WATCHLIST") as { shelfOrder: number | null }).shelfOrder
    ).toBe(2);

    // RECENTLY_ADDED and WATCH_AGAIN default to null (available but not shown)
    expect(
      (dataByType.get("RECENTLY_ADDED") as { shelfOrder: number | null })
        .shelfOrder
    ).toBeNull();
    expect(
      (dataByType.get("WATCH_AGAIN") as { shelfOrder: number | null })
        .shelfOrder
    ).toBeNull();
  });

  it("uses skipDuplicates for race condition safety", async () => {
    mockPrisma.playlist.findMany.mockResolvedValue([]);
    mockPrisma.playlist.createMany.mockResolvedValue({ count: 4 });

    await ensureSystemPlaylists("user-1");

    const createCall = mockPrisma.playlist.createMany.mock.calls[0][0];
    expect(createCall.skipDuplicates).toBe(true);
  });

  it("only creates missing playlists when some already exist", async () => {
    // Two of four already exist
    mockPrisma.playlist.findMany.mockResolvedValue([
      { systemType: "CONTINUE_WATCHING" },
      { systemType: "WATCHLIST" },
    ]);
    mockPrisma.playlist.createMany.mockResolvedValue({ count: 2 });

    await ensureSystemPlaylists("user-1");

    const createCall = mockPrisma.playlist.createMany.mock.calls[0][0];
    expect(createCall.data).toHaveLength(2);

    const types = createCall.data.map(
      (d: { systemType: string }) => d.systemType
    );
    expect(types).toContain("RECENTLY_ADDED");
    expect(types).toContain("WATCH_AGAIN");
    expect(types).not.toContain("CONTINUE_WATCHING");
    expect(types).not.toContain("WATCHLIST");
  });
});
