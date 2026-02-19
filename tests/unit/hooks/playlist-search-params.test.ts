/**
 * Unit tests for playlist URL search param parsers.
 * Verifies nuqs parsers accept valid values and reject invalid ones.
 */

import { describe, it, expect } from "vitest";
import { playlistParsers } from "@/hooks/playlist-search-params";

describe("playlistParsers", () => {
  describe("sort", () => {
    it("accepts 'custom'", () => {
      expect(playlistParsers.sort.parse("custom")).toBe("custom");
    });

    it("accepts 'updated-desc'", () => {
      expect(playlistParsers.sort.parse("updated-desc")).toBe("updated-desc");
    });

    it("accepts 'name-asc'", () => {
      expect(playlistParsers.sort.parse("name-asc")).toBe("name-asc");
    });

    it("rejects invalid sort value", () => {
      expect(playlistParsers.sort.parse("invalid")).toBeNull();
    });

    it("defaults to 'custom'", () => {
      expect(playlistParsers.sort.defaultValue).toBe("custom");
    });
  });

  describe("view", () => {
    it("accepts 'grid'", () => {
      expect(playlistParsers.view.parse("grid")).toBe("grid");
    });

    it("accepts 'tree'", () => {
      expect(playlistParsers.view.parse("tree")).toBe("tree");
    });

    it("rejects invalid view value", () => {
      expect(playlistParsers.view.parse("list")).toBeNull();
    });

    it("defaults to 'grid'", () => {
      expect(playlistParsers.view.defaultValue).toBe("grid");
    });
  });

  describe("filter", () => {
    it("parses valid filter values", () => {
      // Array parser: comma-separated string
      expect(playlistParsers.filter.parse("movie")).toEqual(["movie"]);
    });

    it("parses multiple filter values", () => {
      expect(playlistParsers.filter.parse("movie,tv")).toEqual(["movie", "tv"]);
    });

    it("rejects invalid filter value", () => {
      expect(playlistParsers.filter.parse("anime")).toEqual([]);
    });

    it("defaults to empty array", () => {
      expect(playlistParsers.filter.defaultValue).toEqual([]);
    });
  });

  describe("tab", () => {
    it("accepts 'contents'", () => {
      expect(playlistParsers.tab.parse("contents")).toBe("contents");
    });

    it("accepts 'about'", () => {
      expect(playlistParsers.tab.parse("about")).toBe("about");
    });

    it("rejects invalid tab value", () => {
      expect(playlistParsers.tab.parse("settings")).toBeNull();
    });
  });
});
