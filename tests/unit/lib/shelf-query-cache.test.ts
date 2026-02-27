import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([]),
    playlistItem: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    item: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/tmdb-image-utils", () => ({
  resolveArtworkId: vi.fn().mockReturnValue(null),
}));

describe("getSystemShelfItems cache", () => {
  it("is exported as a function", async () => {
    const { getSystemShelfItems } = await import("@/lib/shelf-query-utils");
    expect(typeof getSystemShelfItems).toBe("function");
  });

  it("returns an array of ShelfItems", async () => {
    const { getSystemShelfItems } = await import("@/lib/shelf-query-utils");
    const result = await getSystemShelfItems("user-1", "RECENTLY_ADDED");
    expect(Array.isArray(result)).toBe(true);
  });
});
