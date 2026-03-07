import { describe, it, expect, vi } from "vitest";
import { buildQueueTrack } from "@/lib/store/track-helpers";

vi.mock("@/lib/tmdb-image-utils", () => ({
  getTmdbPosterUrl: (path: string) => `https://image.tmdb.org/t/p/w500${path}`,
}));

describe("buildQueueTrack", () => {
  it("builds track from TMDB poster path", () => {
    const track = buildQueueTrack({
      fileId: "f1",
      itemId: "i1",
      filename: "movie.mkv",
      mimeType: "video/x-matroska",
      itemName: "Movie",
      tmdbPosterPath: "/abc.jpg",
    });
    expect(track.posterUrl).toBe("https://image.tmdb.org/t/p/w500/abc.jpg");
    expect(track.mimeType).toBe("video/x-matroska");
  });

  it("falls back to hero artwork", () => {
    const track = buildQueueTrack({
      fileId: "f1",
      itemId: "i1",
      filename: "movie.mkv",
      mimeType: null,
      itemName: "Movie",
      heroArtworkId: "art-1",
    });
    expect(track.posterUrl).toBe("/api/artwork/art-1");
    expect(track.mimeType).toBe("video/mp4");
  });

  it("handles no poster", () => {
    const track = buildQueueTrack({
      fileId: "f1",
      itemId: "i1",
      filename: "movie.mkv",
      mimeType: "video/mp4",
      itemName: "Movie",
    });
    expect(track.posterUrl).toBeUndefined();
  });
});
