/**
 * Unit tests for URL search param parser definitions.
 * Verifies nuqs parsers accept valid values, reject invalid ones,
 * and have correct defaults for items, explore, and viewer pages.
 */

import { describe, it, expect } from "vitest";
import {
  itemsParsers,
  exploreParsers,
  viewerParsers,
} from "@/hooks/search-params";

describe("itemsParsers", () => {
  it("has sort, filter, view, and tab keys", () => {
    expect(itemsParsers).toHaveProperty("sort");
    expect(itemsParsers).toHaveProperty("filter");
    expect(itemsParsers).toHaveProperty("view");
    expect(itemsParsers).toHaveProperty("tab");
  });

  describe("sort", () => {
    it("accepts 'custom'", () => {
      expect(itemsParsers.sort.parse("custom")).toBe("custom");
    });

    it("accepts 'name-asc'", () => {
      expect(itemsParsers.sort.parse("name-asc")).toBe("name-asc");
    });

    it("accepts 'name-desc'", () => {
      expect(itemsParsers.sort.parse("name-desc")).toBe("name-desc");
    });

    it("accepts 'updated-desc'", () => {
      expect(itemsParsers.sort.parse("updated-desc")).toBe("updated-desc");
    });

    it("rejects invalid sort value", () => {
      expect(itemsParsers.sort.parse("invalid")).toBeNull();
    });

    it("defaults to 'custom'", () => {
      expect(itemsParsers.sort.defaultValue).toBe("custom");
    });
  });

  describe("filter", () => {
    it("defaults to empty array", () => {
      expect(itemsParsers.filter.defaultValue).toEqual([]);
    });
  });

  describe("view", () => {
    it("accepts 'grid'", () => {
      expect(itemsParsers.view.parse("grid")).toBe("grid");
    });

    it("accepts 'tree'", () => {
      expect(itemsParsers.view.parse("tree")).toBe("tree");
    });

    it("rejects invalid view value", () => {
      expect(itemsParsers.view.parse("list")).toBeNull();
    });

    it("defaults to 'grid'", () => {
      expect(itemsParsers.view.defaultValue).toBe("grid");
    });
  });

  describe("tab", () => {
    it("accepts 'contents'", () => {
      expect(itemsParsers.tab.parse("contents")).toBe("contents");
    });

    it("accepts 'about'", () => {
      expect(itemsParsers.tab.parse("about")).toBe("about");
    });

    it("accepts 'items'", () => {
      expect(itemsParsers.tab.parse("items")).toBe("items");
    });

    it("accepts 'playlists'", () => {
      expect(itemsParsers.tab.parse("playlists")).toBe("playlists");
    });

    it("rejects invalid tab value", () => {
      expect(itemsParsers.tab.parse("settings")).toBeNull();
    });
  });
});

describe("exploreParsers", () => {
  it("has sort, excludeMine, autoplay, and tab keys", () => {
    expect(exploreParsers).toHaveProperty("sort");
    expect(exploreParsers).toHaveProperty("excludeMine");
    expect(exploreParsers).toHaveProperty("autoplay");
    expect(exploreParsers).toHaveProperty("tab");
  });

  describe("sort", () => {
    it("accepts 'updated-desc'", () => {
      expect(exploreParsers.sort.parse("updated-desc")).toBe("updated-desc");
    });

    it("accepts 'name-asc'", () => {
      expect(exploreParsers.sort.parse("name-asc")).toBe("name-asc");
    });

    it("rejects 'custom' (not valid for explore)", () => {
      expect(exploreParsers.sort.parse("custom")).toBeNull();
    });

    it("defaults to 'updated-desc'", () => {
      expect(exploreParsers.sort.defaultValue).toBe("updated-desc");
    });
  });

  describe("excludeMine", () => {
    it("defaults to false", () => {
      expect(exploreParsers.excludeMine.defaultValue).toBe(false);
    });
  });

  describe("autoplay", () => {
    it("defaults to true", () => {
      expect(exploreParsers.autoplay.defaultValue).toBe(true);
    });
  });

  describe("tab", () => {
    it("accepts 'items'", () => {
      expect(exploreParsers.tab.parse("items")).toBe("items");
    });

    it("accepts 'playlists'", () => {
      expect(exploreParsers.tab.parse("playlists")).toBe("playlists");
    });

    it("rejects invalid tab value", () => {
      expect(exploreParsers.tab.parse("contents")).toBeNull();
    });
  });
});

describe("viewerParsers", () => {
  it("has sort, filter, and tab keys", () => {
    expect(viewerParsers).toHaveProperty("sort");
    expect(viewerParsers).toHaveProperty("filter");
    expect(viewerParsers).toHaveProperty("tab");
  });

  describe("sort", () => {
    it("accepts 'updated-desc'", () => {
      expect(viewerParsers.sort.parse("updated-desc")).toBe("updated-desc");
    });

    it("rejects 'custom' (not valid for viewer)", () => {
      expect(viewerParsers.sort.parse("custom")).toBeNull();
    });

    it("defaults to 'updated-desc'", () => {
      expect(viewerParsers.sort.defaultValue).toBe("updated-desc");
    });
  });

  describe("filter", () => {
    it("defaults to empty array", () => {
      expect(viewerParsers.filter.defaultValue).toEqual([]);
    });
  });

  describe("tab", () => {
    it("accepts 'items'", () => {
      expect(viewerParsers.tab.parse("items")).toBe("items");
    });

    it("accepts 'playlists'", () => {
      expect(viewerParsers.tab.parse("playlists")).toBe("playlists");
    });

    it("rejects 'contents' (not valid for viewer)", () => {
      expect(viewerParsers.tab.parse("contents")).toBeNull();
    });
  });
});
