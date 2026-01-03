/**
 * Unit tests for WebDAV URL and path utilities.
 */

import { describe, it, expect } from "vitest";
import {
  buildWebDavUrl,
  sanitizeWebDavPath,
  isValidWebDavPath,
} from "@/lib/webdav-utils";

describe("buildWebDavUrl", () => {
  it("builds URL with path", () => {
    const url = buildWebDavUrl(
      "https://webdav.example.com",
      "/movies/film.mp4"
    );
    expect(url).toBe("https://webdav.example.com/movies/film.mp4");
  });

  it("handles base URL with trailing slash", () => {
    const url = buildWebDavUrl(
      "https://webdav.example.com/",
      "/movies/film.mp4"
    );
    expect(url).toBe("https://webdav.example.com/movies/film.mp4");
  });

  it("handles path without leading slash", () => {
    const url = buildWebDavUrl("https://webdav.example.com", "movies/film.mp4");
    expect(url).toBe("https://webdav.example.com/movies/film.mp4");
  });

  it("URL-encodes special characters in path", () => {
    const url = buildWebDavUrl(
      "https://webdav.example.com",
      "/movies/The Matrix (1999)/film.mp4"
    );
    expect(url).toBe(
      "https://webdav.example.com/movies/The%20Matrix%20(1999)/film.mp4"
    );
  });

  it("handles Unicode characters", () => {
    const url = buildWebDavUrl(
      "https://webdav.example.com",
      "/movies/日本語/video.mp4"
    );
    expect(url).toContain("/movies/");
    expect(url).toContain("/video.mp4");
  });
});

describe("sanitizeWebDavPath", () => {
  it("returns valid path unchanged", () => {
    expect(sanitizeWebDavPath("/movies/film.mp4")).toBe("/movies/film.mp4");
  });

  it("removes path traversal attempts", () => {
    expect(sanitizeWebDavPath("/movies/../../../etc/passwd")).toBe(
      "/movies/etc/passwd"
    );
    expect(sanitizeWebDavPath("/movies/..\\..\\windows")).toBe(
      "/movies/windows"
    );
  });

  it("removes null bytes", () => {
    expect(sanitizeWebDavPath("/movies/file\x00.mp4")).toBe("/movies/file.mp4");
  });

  it("normalizes multiple slashes", () => {
    expect(sanitizeWebDavPath("/movies//nested///path")).toBe(
      "/movies/nested/path"
    );
  });

  it("ensures leading slash", () => {
    expect(sanitizeWebDavPath("movies/film.mp4")).toBe("/movies/film.mp4");
  });

  it("removes trailing slash", () => {
    expect(sanitizeWebDavPath("/movies/folder/")).toBe("/movies/folder");
  });
});

describe("isValidWebDavPath", () => {
  it("returns true for valid paths", () => {
    expect(isValidWebDavPath("/movies/film.mp4")).toBe(true);
    expect(isValidWebDavPath("/path/to/file")).toBe(true);
  });

  it("returns false for paths with traversal", () => {
    expect(isValidWebDavPath("/movies/../secret")).toBe(false);
    expect(isValidWebDavPath("/../../../etc/passwd")).toBe(false);
  });

  it("returns false for paths with null bytes", () => {
    expect(isValidWebDavPath("/movies/file\x00.mp4")).toBe(false);
  });

  it("returns false for empty path", () => {
    expect(isValidWebDavPath("")).toBe(false);
  });

  it("returns false for paths exceeding max length", () => {
    const longPath = "/" + "a".repeat(5000);
    expect(isValidWebDavPath(longPath)).toBe(false);
  });

  it("returns true for paths at max length", () => {
    const maxPath = "/" + "a".repeat(4094);
    expect(isValidWebDavPath(maxPath)).toBe(true);
  });

  it("returns false for paths with control characters", () => {
    expect(isValidWebDavPath("/movies/file\x01.mp4")).toBe(false);
    expect(isValidWebDavPath("/movies/file\x1F.mp4")).toBe(false);
    expect(isValidWebDavPath("/path\x08/file")).toBe(false);
  });

  it("allows tabs and newlines in paths", () => {
    // These are technically valid in some filesystems
    expect(isValidWebDavPath("/movies/file\t.mp4")).toBe(true);
  });
});
