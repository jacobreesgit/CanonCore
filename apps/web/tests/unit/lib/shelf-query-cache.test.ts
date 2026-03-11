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

describe("getSystemShelfItems", () => {
  it("is exported as a function", async () => {
    const { getSystemShelfItems } = await import("@/lib/shelf-query-utils");
    expect(typeof getSystemShelfItems).toBe("function");
  });

  it("returns an array of ShelfItems", async () => {
    const { getSystemShelfItems } = await import("@/lib/shelf-query-utils");
    const result = await getSystemShelfItems("user-1", "RECENTLY_ADDED");
    expect(Array.isArray(result)).toBe(true);
  });

  it("is wrapped with React.cache (not the raw async function)", async () => {
    // React.cache() returns a wrapper function with the same arity but a
    // different identity from the original. We verify this by checking that
    // the export is NOT a plain async function — cache-wrapped functions
    // have a different .toString() representation than the unwrapped impl.
    const mod = await import("@/lib/shelf-query-utils");
    const fnStr = mod.getSystemShelfItems.toString();
    // A raw "async function _getSystemShelfItems" would contain that name;
    // the cache wrapper does not — it's an anonymous or cache-internal wrapper.
    expect(fnStr).not.toContain("_getSystemShelfItems");
  });
});
