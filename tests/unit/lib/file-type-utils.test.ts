/**
 * Unit tests for file type detection utilities.
 */

import { describe, it, expect } from "vitest";
import {
  getFileTypeByExtension,
  getMimeTypeByExtension,
  MEDIA_EXTENSIONS,
  ARTWORK_EXTENSIONS,
  SUBTITLE_EXTENSIONS,
} from "@/lib/file-type-utils";

describe("getFileTypeByExtension", () => {
  describe("MEDIA files", () => {
    it.each([
      "video.mp4",
      "movie.mkv",
      "film.avi",
      "clip.m4v",
      "stream.webm",
      "recording.mov",
      "song.mp3",
      "track.m4a",
      "album.flac",
      "sound.wav",
      "audio.ogg",
    ])("detects %s as MEDIA", (filename) => {
      expect(getFileTypeByExtension(filename)).toBe("MEDIA");
    });

    it("handles uppercase extensions", () => {
      expect(getFileTypeByExtension("VIDEO.MP4")).toBe("MEDIA");
      expect(getFileTypeByExtension("MOVIE.MKV")).toBe("MEDIA");
    });
  });

  describe("ARTWORK files", () => {
    it.each([
      "poster.jpg",
      "cover.jpeg",
      "thumbnail.png",
      "banner.webp",
      "animated.gif",
    ])("detects %s as ARTWORK", (filename) => {
      expect(getFileTypeByExtension(filename)).toBe("ARTWORK");
    });
  });

  describe("SUBTITLE files", () => {
    it.each(["english.srt", "captions.vtt", "subtitles.sub", "dialogue.ass"])(
      "detects %s as SUBTITLE",
      (filename) => {
        expect(getFileTypeByExtension(filename)).toBe("SUBTITLE");
      }
    );
  });

  describe("unknown files", () => {
    it("returns null for unknown extensions", () => {
      expect(getFileTypeByExtension("document.pdf")).toBeNull();
      expect(getFileTypeByExtension("archive.zip")).toBeNull();
      expect(getFileTypeByExtension("noextension")).toBeNull();
    });
  });
});

describe("getMimeTypeByExtension", () => {
  it("returns correct mime types for video", () => {
    expect(getMimeTypeByExtension("video.mp4")).toBe("video/mp4");
    expect(getMimeTypeByExtension("movie.mkv")).toBe("video/x-matroska");
    expect(getMimeTypeByExtension("film.webm")).toBe("video/webm");
  });

  it("returns correct mime types for audio", () => {
    expect(getMimeTypeByExtension("song.mp3")).toBe("audio/mpeg");
    expect(getMimeTypeByExtension("track.flac")).toBe("audio/flac");
  });

  it("returns correct mime types for images", () => {
    expect(getMimeTypeByExtension("poster.jpg")).toBe("image/jpeg");
    expect(getMimeTypeByExtension("cover.png")).toBe("image/png");
    expect(getMimeTypeByExtension("banner.webp")).toBe("image/webp");
  });

  it("returns correct mime types for subtitles", () => {
    expect(getMimeTypeByExtension("english.srt")).toBe("text/plain");
    expect(getMimeTypeByExtension("captions.vtt")).toBe("text/vtt");
  });

  it("returns null for unknown extensions", () => {
    expect(getMimeTypeByExtension("unknown.xyz")).toBeNull();
  });
});

describe("extension arrays", () => {
  it("MEDIA_EXTENSIONS contains all video/audio extensions", () => {
    expect(MEDIA_EXTENSIONS).toContain(".mp4");
    expect(MEDIA_EXTENSIONS).toContain(".mkv");
    expect(MEDIA_EXTENSIONS).toContain(".mp3");
    expect(MEDIA_EXTENSIONS).toContain(".flac");
  });

  it("ARTWORK_EXTENSIONS contains all image extensions", () => {
    expect(ARTWORK_EXTENSIONS).toContain(".jpg");
    expect(ARTWORK_EXTENSIONS).toContain(".png");
    expect(ARTWORK_EXTENSIONS).toContain(".webp");
  });

  it("SUBTITLE_EXTENSIONS contains all subtitle extensions", () => {
    expect(SUBTITLE_EXTENSIONS).toContain(".srt");
    expect(SUBTITLE_EXTENSIONS).toContain(".vtt");
    expect(SUBTITLE_EXTENSIONS).toContain(".ass");
  });
});
