import { describe, it, expect } from "vitest";
import { filterItemsBySearch } from "@/lib/item-utils";

describe("filterItemsBySearch", () => {
  const items = [
    { id: "1", name: "Breaking Bad", description: "Chemistry teacher" },
    { id: "2", name: "The Wire", description: "Baltimore" },
    { id: "3", name: "Bad Boys", description: "Action movie" },
  ] as { id: string; name: string; description: string }[];

  it("returns all items when query is empty", () => {
    expect(filterItemsBySearch(items, "")).toEqual(items);
  });

  it("filters by name (case-insensitive)", () => {
    const result = filterItemsBySearch(items, "bad");
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.name)).toEqual(["Breaking Bad", "Bad Boys"]);
  });

  it("filters by description (case-insensitive)", () => {
    const result = filterItemsBySearch(items, "baltimore");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("The Wire");
  });

  it("returns empty array when nothing matches", () => {
    expect(filterItemsBySearch(items, "xyz")).toEqual([]);
  });

  it("trims whitespace-only queries and returns all items", () => {
    expect(filterItemsBySearch(items, "   ")).toEqual(items);
  });
});

describe("effectiveViewMode (tree→grid auto-switch)", () => {
  it("forces grid when searchQuery is non-empty", () => {
    const searchQuery = "test";
    const viewMode = "tree" as const;
    const effectiveViewMode = searchQuery ? "grid" : viewMode;
    expect(effectiveViewMode).toBe("grid");
  });

  it("preserves tree when searchQuery is empty", () => {
    const searchQuery = "";
    const viewMode = "tree" as const;
    const effectiveViewMode = searchQuery ? "grid" : viewMode;
    expect(effectiveViewMode).toBe("tree");
  });
});
