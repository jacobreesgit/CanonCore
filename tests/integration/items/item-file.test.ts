/**
 * Integration tests for ItemFile model.
 * Tests with real database for file records attached to items.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { FileType } from "@prisma/client";
import "../setup";

// Use unique ID per test run to avoid conflicts
const TEST_USER_ID = `test-itemfile-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `itemfile-${Date.now()}@test.example.com`;

describe("ItemFile integration", () => {
  let testItemId: string;

  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });

    // Create test item to attach files to
    const item = await prisma.item.create({
      data: {
        name: "Test Item",
        userId: TEST_USER_ID,
      },
    });
    testItemId = item.id;
  });

  afterAll(async () => {
    // Clean up: delete all items (cascades to files), then delete user
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("creates ItemFile with MEDIA type", async () => {
    const file = await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "video.mp4",
        sftpPath: "/media/video.mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(1024000),
      },
    });

    expect(file.id).toBeDefined();
    expect(file.filename).toBe("video.mp4");
    expect(file.sftpPath).toBe("/media/video.mp4");
    expect(file.fileType).toBe(FileType.MEDIA);
    expect(file.mimeType).toBe("video/mp4");
    expect(file.size).toBe(BigInt(1024000));

    // Clean up
    await prisma.itemFile.delete({ where: { id: file.id } });
  });

  it("creates ItemFile with ARTWORK type", async () => {
    const file = await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "cover.jpg",
        sftpPath: "/media/cover.jpg",
        fileType: FileType.ARTWORK,
        mimeType: "image/jpeg",
        size: BigInt(50000),
      },
    });

    expect(file.id).toBeDefined();
    expect(file.filename).toBe("cover.jpg");
    expect(file.fileType).toBe(FileType.ARTWORK);

    // Clean up
    await prisma.itemFile.delete({ where: { id: file.id } });
  });

  it("creates ItemFile with SUBTITLE type", async () => {
    const file = await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "subtitles.srt",
        sftpPath: "/media/subtitles.srt",
        fileType: FileType.SUBTITLE,
        mimeType: "application/x-subrip",
      },
    });

    expect(file.id).toBeDefined();
    expect(file.filename).toBe("subtitles.srt");
    expect(file.fileType).toBe(FileType.SUBTITLE);

    // Clean up
    await prisma.itemFile.delete({ where: { id: file.id } });
  });

  it("enforces unique constraint on itemId + sftpPath", async () => {
    // Create first file
    await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "unique-test.mp4",
        sftpPath: "/media/unique-test.mp4",
        fileType: FileType.MEDIA,
      },
    });

    // Attempt to create duplicate should fail
    await expect(
      prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "unique-test-duplicate.mp4",
          sftpPath: "/media/unique-test.mp4", // Same path
          fileType: FileType.MEDIA,
        },
      })
    ).rejects.toThrow();

    // Clean up
    await prisma.itemFile.deleteMany({
      where: { itemId: testItemId, sftpPath: "/media/unique-test.mp4" },
    });
  });

  it("cascade deletes files when Item is deleted", async () => {
    // Create a new item with files
    const item = await prisma.item.create({
      data: {
        name: "Item With Files",
        userId: TEST_USER_ID,
      },
    });

    // Create files attached to the item
    const file1 = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "file1.mp4",
        sftpPath: "/cascade/file1.mp4",
        fileType: FileType.MEDIA,
      },
    });

    const file2 = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "file2.jpg",
        sftpPath: "/cascade/file2.jpg",
        fileType: FileType.ARTWORK,
      },
    });

    // Verify files exist
    const filesBeforeDelete = await prisma.itemFile.findMany({
      where: { itemId: item.id },
    });
    expect(filesBeforeDelete).toHaveLength(2);

    // Delete the item
    await prisma.item.delete({ where: { id: item.id } });

    // Files should be cascade deleted
    const file1After = await prisma.itemFile.findUnique({
      where: { id: file1.id },
    });
    const file2After = await prisma.itemFile.findUnique({
      where: { id: file2.id },
    });

    expect(file1After).toBeNull();
    expect(file2After).toBeNull();
  });

  it("stores playback position and duration", async () => {
    const file = await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "movie.mkv",
        sftpPath: "/media/movie.mkv",
        fileType: FileType.MEDIA,
        mimeType: "video/x-matroska",
        playbackPosition: 1234.5,
        playbackDuration: 7200.0,
      },
    });

    expect(file.playbackPosition).toBe(1234.5);
    expect(file.playbackDuration).toBe(7200.0);

    // Update playback position
    const updated = await prisma.itemFile.update({
      where: { id: file.id },
      data: { playbackPosition: 2500.0 },
    });

    expect(updated.playbackPosition).toBe(2500.0);
    expect(updated.playbackDuration).toBe(7200.0);

    // Clean up
    await prisma.itemFile.delete({ where: { id: file.id } });
  });

  it("retrieves files through Item relation", async () => {
    // Create files for the test item
    await prisma.itemFile.createMany({
      data: [
        {
          itemId: testItemId,
          filename: "relation-test.mp4",
          sftpPath: "/relation/video.mp4",
          fileType: FileType.MEDIA,
        },
        {
          itemId: testItemId,
          filename: "relation-cover.jpg",
          sftpPath: "/relation/cover.jpg",
          fileType: FileType.ARTWORK,
        },
      ],
    });

    // Get item with files
    const itemWithFiles = await prisma.item.findUnique({
      where: { id: testItemId },
      include: { files: true },
    });

    expect(itemWithFiles?.files).toBeDefined();
    expect(itemWithFiles?.files.length).toBeGreaterThanOrEqual(2);

    const mediaFile = itemWithFiles?.files.find(
      (f) => f.sftpPath === "/relation/video.mp4"
    );
    const artworkFile = itemWithFiles?.files.find(
      (f) => f.sftpPath === "/relation/cover.jpg"
    );

    expect(mediaFile?.fileType).toBe(FileType.MEDIA);
    expect(artworkFile?.fileType).toBe(FileType.ARTWORK);

    // Clean up
    await prisma.itemFile.deleteMany({
      where: {
        sftpPath: { in: ["/relation/video.mp4", "/relation/cover.jpg"] },
      },
    });
  });

  it("stores sftpModifiedAt timestamp", async () => {
    const modifiedAt = new Date("2025-12-01T12:00:00Z");

    const file = await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "timestamped.mp4",
        sftpPath: "/media/timestamped.mp4",
        fileType: FileType.MEDIA,
        sftpModifiedAt: modifiedAt,
      },
    });

    expect(file.sftpModifiedAt).toEqual(modifiedAt);

    // Clean up
    await prisma.itemFile.delete({ where: { id: file.id } });
  });
});
