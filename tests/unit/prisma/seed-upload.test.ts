/**
 * Unit tests for seed upload utility functions.
 * Tests file discovery and path mapping for SFTP uploads.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as path from "path";
import type * as fsType from "fs";

// Create a mock for readdirSync that we can control per test
const mockReaddirSync = vi.fn();

// Mock the fs module at the module level
vi.mock("fs", () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

// Import after mocking
import { discoverSeedFiles, mapLocalToRemotePath } from "@/prisma/seed-utils";

describe("discoverSeedFiles", () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
  });

  it("returns correct file list from directory structure", () => {
    // Mock directory structure:
    // /seed-media/
    //   Movies/
    //     Inception (2010)/
    //       poster.jpg
    //       video.mp4
    //   Music/
    //     album.flac
    const mockEntries: Record<string, fsType.Dirent[]> = {
      "/seed-media": [
        {
          name: "Movies",
          isDirectory: () => true,
          isFile: () => false,
        } as fsType.Dirent,
        {
          name: "Music",
          isDirectory: () => true,
          isFile: () => false,
        } as fsType.Dirent,
      ],
      "/seed-media/Movies": [
        {
          name: "Inception (2010)",
          isDirectory: () => true,
          isFile: () => false,
        } as fsType.Dirent,
      ],
      "/seed-media/Movies/Inception (2010)": [
        {
          name: "poster.jpg",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
        {
          name: "video.mp4",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
      ],
      "/seed-media/Music": [
        {
          name: "album.flac",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
      ],
    };

    mockReaddirSync.mockImplementation((dir: string) => {
      return mockEntries[dir] || [];
    });

    const files = discoverSeedFiles("/seed-media");

    expect(files).toHaveLength(3);
    expect(files).toContain(
      path.join("/seed-media", "Movies", "Inception (2010)", "poster.jpg")
    );
    expect(files).toContain(
      path.join("/seed-media", "Movies", "Inception (2010)", "video.mp4")
    );
    expect(files).toContain(path.join("/seed-media", "Music", "album.flac"));
  });

  it("excludes .DS_Store files", () => {
    // Mock directory with .DS_Store files
    const mockEntries: Record<string, fsType.Dirent[]> = {
      "/seed-media": [
        {
          name: ".DS_Store",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
        {
          name: "Movies",
          isDirectory: () => true,
          isFile: () => false,
        } as fsType.Dirent,
      ],
      "/seed-media/Movies": [
        {
          name: ".DS_Store",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
        {
          name: "poster.jpg",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
        {
          name: ".hidden",
          isDirectory: () => false,
          isFile: () => true,
        } as fsType.Dirent,
      ],
    };

    mockReaddirSync.mockImplementation((dir: string) => {
      return mockEntries[dir] || [];
    });

    const files = discoverSeedFiles("/seed-media");

    // Should only contain poster.jpg, not .DS_Store or .hidden
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("poster.jpg");
    expect(files.some((f) => f.includes(".DS_Store"))).toBe(false);
    expect(files.some((f) => f.includes(".hidden"))).toBe(false);
  });
});

describe("mapLocalToRemotePath", () => {
  it("calculates correct paths", () => {
    const localPath =
      "/home/user/seed-media/Movies/Inception (2010)/poster.jpg";
    const basePath = "/home/user/seed-media";

    const remotePath = mapLocalToRemotePath(localPath, basePath);

    expect(remotePath).toBe("/Movies/Inception (2010)/poster.jpg");
  });

  it("handles spaces in paths", () => {
    const localPath =
      "/home/user/seed-media/Movies/The Shawshank Redemption (1994)/poster.jpg";
    const basePath = "/home/user/seed-media";

    const remotePath = mapLocalToRemotePath(localPath, basePath);

    expect(remotePath).toBe(
      "/Movies/The Shawshank Redemption (1994)/poster.jpg"
    );
  });

  it("handles deeply nested paths", () => {
    const localPath =
      "/seed-media/TV Shows/Breaking Bad/Season 1/S01E01 - Pilot/video.mp4";
    const basePath = "/seed-media";

    const remotePath = mapLocalToRemotePath(localPath, basePath);

    expect(remotePath).toBe(
      "/TV Shows/Breaking Bad/Season 1/S01E01 - Pilot/video.mp4"
    );
  });

  it("handles file at root level", () => {
    const localPath = "/seed-media/readme.txt";
    const basePath = "/seed-media";

    const remotePath = mapLocalToRemotePath(localPath, basePath);

    expect(remotePath).toBe("/readme.txt");
  });

  it("throws error when path is outside base path", () => {
    const localPath = "/other/path/file.txt";
    const basePath = "/seed-media";

    expect(() => mapLocalToRemotePath(localPath, basePath)).toThrow(
      'Path "/other/path/file.txt" is not within base path "/seed-media"'
    );
  });

  it("throws error when path escapes with ..", () => {
    const localPath = "/seed-media/../etc/passwd";
    const basePath = "/seed-media";

    expect(() => mapLocalToRemotePath(localPath, basePath)).toThrow(
      "is not within base path"
    );
  });
});
