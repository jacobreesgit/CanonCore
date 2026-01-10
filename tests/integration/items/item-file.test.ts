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
        driveFileId: "drive-media-video-mp4",
        fileType: FileType.MEDIA,
        mimeType: "video/mp4",
        size: BigInt(1024000),
      },
    });

    expect(file.id).toBeDefined();
    expect(file.filename).toBe("video.mp4");
    expect(file.driveFileId).toBe("drive-media-video-mp4");
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
        driveFileId: "drive-media-cover-jpg",
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
        driveFileId: "drive-media-subtitles-srt",
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

  it("enforces unique constraint on itemId + driveFileId", async () => {
    // Create first file
    await prisma.itemFile.create({
      data: {
        itemId: testItemId,
        filename: "unique-test.mp4",
        driveFileId: "drive-unique-test-mp4",
        fileType: FileType.MEDIA,
      },
    });

    // Attempt to create duplicate should fail
    await expect(
      prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "unique-test-duplicate.mp4",
          driveFileId: "drive-unique-test-mp4", // Same drive file
          fileType: FileType.MEDIA,
        },
      })
    ).rejects.toThrow();

    // Clean up
    await prisma.itemFile.deleteMany({
      where: { itemId: testItemId, driveFileId: "drive-unique-test-mp4" },
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
        driveFileId: "drive-cascade-file1-mp4",
        fileType: FileType.MEDIA,
      },
    });

    const file2 = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "file2.jpg",
        driveFileId: "drive-cascade-file2-jpg",
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
        driveFileId: "drive-media-movie-mkv",
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
          driveFileId: "drive-relation-video-mp4",
          fileType: FileType.MEDIA,
        },
        {
          itemId: testItemId,
          filename: "relation-cover.jpg",
          driveFileId: "drive-relation-cover-jpg",
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
      (f) => f.driveFileId === "drive-relation-video-mp4"
    );
    const artworkFile = itemWithFiles?.files.find(
      (f) => f.driveFileId === "drive-relation-cover-jpg"
    );

    expect(mediaFile?.fileType).toBe(FileType.MEDIA);
    expect(artworkFile?.fileType).toBe(FileType.ARTWORK);

    // Clean up
    await prisma.itemFile.deleteMany({
      where: {
        driveFileId: {
          in: ["drive-relation-video-mp4", "drive-relation-cover-jpg"],
        },
      },
    });
  });

  describe("isPrimary functionality", () => {
    it("creates file with isPrimary defaulting to false", async () => {
      const file = await prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "default-primary.mp4",
          driveFileId: "drive-primary-default-mp4",
          fileType: FileType.MEDIA,
        },
      });

      expect(file.isPrimary).toBe(false);

      // Clean up
      await prisma.itemFile.delete({ where: { id: file.id } });
    });

    it("creates file with isPrimary set to true", async () => {
      const file = await prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "explicit-primary.mp4",
          driveFileId: "drive-primary-explicit-mp4",
          fileType: FileType.MEDIA,
          isPrimary: true,
        },
      });

      expect(file.isPrimary).toBe(true);

      // Clean up
      await prisma.itemFile.delete({ where: { id: file.id } });
    });

    it("sets primary file atomically using transaction", async () => {
      // Create two files of the same type
      const file1 = await prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "primary-1.jpg",
          driveFileId: "drive-primary-artwork1-jpg",
          fileType: FileType.ARTWORK,
          isPrimary: true,
        },
      });

      const file2 = await prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "primary-2.jpg",
          driveFileId: "drive-primary-artwork2-jpg",
          fileType: FileType.ARTWORK,
          isPrimary: false,
        },
      });

      // Use transaction to switch primary
      await prisma.$transaction([
        prisma.itemFile.updateMany({
          where: {
            itemId: testItemId,
            fileType: FileType.ARTWORK,
            isPrimary: true,
          },
          data: { isPrimary: false },
        }),
        prisma.itemFile.update({
          where: { id: file2.id },
          data: { isPrimary: true },
        }),
      ]);

      // Verify only file2 is primary
      const file1After = await prisma.itemFile.findUnique({
        where: { id: file1.id },
      });
      const file2After = await prisma.itemFile.findUnique({
        where: { id: file2.id },
      });

      expect(file1After?.isPrimary).toBe(false);
      expect(file2After?.isPrimary).toBe(true);

      // Clean up
      await prisma.itemFile.deleteMany({
        where: {
          driveFileId: {
            in: ["drive-primary-artwork1-jpg", "drive-primary-artwork2-jpg"],
          },
        },
      });
    });

    it("maintains separate primary per file type", async () => {
      // Create primary for MEDIA and ARTWORK types
      const mediaFile = await prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "primary-media.mp4",
          driveFileId: "drive-primary-types-media-mp4",
          fileType: FileType.MEDIA,
          isPrimary: true,
        },
      });

      const artworkFile = await prisma.itemFile.create({
        data: {
          itemId: testItemId,
          filename: "primary-artwork.jpg",
          driveFileId: "drive-primary-types-artwork-jpg",
          fileType: FileType.ARTWORK,
          isPrimary: true,
        },
      });

      // Both should be primary (different types)
      expect(mediaFile.isPrimary).toBe(true);
      expect(artworkFile.isPrimary).toBe(true);

      // Query using composite index
      const primaryMedia = await prisma.itemFile.findFirst({
        where: {
          itemId: testItemId,
          fileType: FileType.MEDIA,
          isPrimary: true,
        },
      });

      const primaryArtwork = await prisma.itemFile.findFirst({
        where: {
          itemId: testItemId,
          fileType: FileType.ARTWORK,
          isPrimary: true,
        },
      });

      expect(primaryMedia?.id).toBe(mediaFile.id);
      expect(primaryArtwork?.id).toBe(artworkFile.id);

      // Clean up
      await prisma.itemFile.deleteMany({
        where: {
          driveFileId: {
            in: [
              "drive-primary-types-media-mp4",
              "drive-primary-types-artwork-jpg",
            ],
          },
        },
      });
    });

    it("orders files by isPrimary desc then filename asc", async () => {
      // Create files in specific order
      await prisma.itemFile.createMany({
        data: [
          {
            itemId: testItemId,
            filename: "z-file.mp4",
            driveFileId: "drive-primary-order-z-mp4",
            fileType: FileType.MEDIA,
            isPrimary: false,
          },
          {
            itemId: testItemId,
            filename: "a-file.mp4",
            driveFileId: "drive-primary-order-a-mp4",
            fileType: FileType.MEDIA,
            isPrimary: false,
          },
          {
            itemId: testItemId,
            filename: "m-primary.mp4",
            driveFileId: "drive-primary-order-m-mp4",
            fileType: FileType.MEDIA,
            isPrimary: true,
          },
        ],
      });

      // Query with ordering
      const files = await prisma.itemFile.findMany({
        where: {
          itemId: testItemId,
          driveFileId: { startsWith: "drive-primary-order-" },
        },
        orderBy: [{ isPrimary: "desc" }, { filename: "asc" }],
      });

      expect(files).toHaveLength(3);
      expect(files[0].filename).toBe("m-primary.mp4"); // Primary first
      expect(files[1].filename).toBe("a-file.mp4"); // Then alpha order
      expect(files[2].filename).toBe("z-file.mp4");

      // Clean up
      await prisma.itemFile.deleteMany({
        where: { driveFileId: { startsWith: "drive-primary-order-" } },
      });
    });
  });
});
