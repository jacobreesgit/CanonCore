import { describe, it, expect } from "vitest";
import { getResolutionLabel, formatDuration } from "@/lib/media-metadata";

describe("getResolutionLabel", () => {
  it("returns '4K' for height >= 2160", () => {
    expect(getResolutionLabel(2160)).toBe("4K");
    expect(getResolutionLabel(3840)).toBe("4K");
  });

  it("returns '1440p' for height >= 1440", () => {
    expect(getResolutionLabel(1440)).toBe("1440p");
    expect(getResolutionLabel(2000)).toBe("1440p");
  });

  it("returns '1080p' for height >= 1080", () => {
    expect(getResolutionLabel(1080)).toBe("1080p");
    expect(getResolutionLabel(1439)).toBe("1080p");
  });

  it("returns '720p' for height >= 720", () => {
    expect(getResolutionLabel(720)).toBe("720p");
    expect(getResolutionLabel(900)).toBe("720p");
  });

  it("returns 'SD' for height < 720", () => {
    expect(getResolutionLabel(480)).toBe("SD");
    expect(getResolutionLabel(360)).toBe("SD");
  });

  it("returns null for null/undefined input", () => {
    expect(getResolutionLabel(null)).toBeNull();
    expect(getResolutionLabel(undefined)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats milliseconds to human readable", () => {
    expect(formatDuration(6120000)).toBe("1h 42m");
    expect(formatDuration(3600000)).toBe("1h 0m");
    expect(formatDuration(1800000)).toBe("30m");
    expect(formatDuration(90000)).toBe("2m");
    expect(formatDuration(60000)).toBe("1m");
  });

  it("returns null for null/undefined/zero input", () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(0)).toBeNull();
  });
});
