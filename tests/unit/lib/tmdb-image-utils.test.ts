/**
 * Unit tests for TMDB image URL utility functions.
 * Tests getTmdbPosterUrl and getTmdbBackdropUrl from lib/tmdb-image-utils.
 */

import { describe, it, expect } from "vitest";
import { getTmdbPosterUrl, getTmdbBackdropUrl } from "@/lib/tmdb-image-utils";

describe("getTmdbPosterUrl", () => {
  it("returns null when path is null", () => {
    expect(getTmdbPosterUrl(null)).toBeNull();
  });

  it("returns null when path is empty string", () => {
    expect(getTmdbPosterUrl("")).toBeNull();
  });

  it("constructs full URL with default w780 size", () => {
    expect(getTmdbPosterUrl("/abc123.jpg")).toBe(
      "https://image.tmdb.org/t/p/w780/abc123.jpg"
    );
  });

  it("constructs full URL with custom size", () => {
    expect(getTmdbPosterUrl("/abc123.jpg", "w342")).toBe(
      "https://image.tmdb.org/t/p/w342/abc123.jpg"
    );
  });
});

describe("getTmdbBackdropUrl", () => {
  it("returns null when path is null", () => {
    expect(getTmdbBackdropUrl(null)).toBeNull();
  });

  it("returns null when path is empty string", () => {
    expect(getTmdbBackdropUrl("")).toBeNull();
  });

  it("constructs full URL with default original size", () => {
    expect(getTmdbBackdropUrl("/xyz789.jpg")).toBe(
      "https://image.tmdb.org/t/p/original/xyz789.jpg"
    );
  });

  it("constructs full URL with custom size", () => {
    expect(getTmdbBackdropUrl("/xyz789.jpg", "w1280")).toBe(
      "https://image.tmdb.org/t/p/w1280/xyz789.jpg"
    );
  });
});
