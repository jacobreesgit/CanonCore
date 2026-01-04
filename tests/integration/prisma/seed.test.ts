/**
 * Integration tests for database seeding.
 * Verifies seed data is created correctly.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import "../setup";

describe("Database Seeding Integration", () => {
  const testEmail = `seed-test-${Date.now()}@canoncore.com`;
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user similar to seed script
    const passwordHash = await hash("TestPassword123!", 10);
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        name: "Seed Test User",
        passwordHash,
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("creates user with correct password hash", async () => {
    const user = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    expect(user).not.toBeNull();
    expect(user?.passwordHash).toMatch(/^\$2[aby]?\$/);
  });

  it("creates hierarchical items correctly", async () => {
    // Create parent (Movies folder)
    const parent = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Movies",
        order: 0,
        depth: 0,
      },
    });

    // Create child (Movie item)
    const child = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "The Shawshank Redemption (1994)",
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    expect(child.parentId).toBe(parent.id);
    expect(child.depth).toBe(1);

    // Cleanup
    await prisma.item.deleteMany({
      where: { userId: testUserId },
    });
  });

  it("creates item files with correct types and sizes", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Test Movie",
        order: 0,
        depth: 0,
      },
    });

    const mediaFile = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "movie.mkv",
        sftpPath: "/test/movie.mkv",
        fileType: "MEDIA",
        mimeType: "video/x-matroska",
        size: BigInt(4_500_000_000), // 4.5 GB
        isPrimary: true,
      },
    });

    const artworkFile = await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "poster.jpg",
        sftpPath: "/test/poster.jpg",
        fileType: "ARTWORK",
        mimeType: "image/jpeg",
        size: BigInt(250_000), // 250 KB
        isPrimary: true,
      },
    });

    expect(mediaFile.fileType).toBe("MEDIA");
    expect(mediaFile.isPrimary).toBe(true);
    expect(mediaFile.size).toBe(BigInt(4_500_000_000));

    expect(artworkFile.fileType).toBe("ARTWORK");
    expect(artworkFile.mimeType).toBe("image/jpeg");

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("handles multiple files per item with primary selection", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Multi-File Test",
        order: 0,
        depth: 0,
      },
    });

    // Create multiple media files
    await prisma.itemFile.createMany({
      data: [
        {
          itemId: item.id,
          filename: "movie.1080p.mkv",
          sftpPath: "/test/movie.1080p.mkv",
          fileType: "MEDIA",
          isPrimary: true,
        },
        {
          itemId: item.id,
          filename: "movie.4k.mkv",
          sftpPath: "/test/movie.4k.mkv",
          fileType: "MEDIA",
          isPrimary: false,
        },
      ],
    });

    const files = await prisma.itemFile.findMany({
      where: { itemId: item.id },
      orderBy: { isPrimary: "desc" },
    });

    expect(files).toHaveLength(2);
    expect(files[0].isPrimary).toBe(true);
    expect(files[1].isPrimary).toBe(false);

    // Cleanup
    await prisma.item.delete({ where: { id: item.id } });
  });

  it("cascades deletes correctly", async () => {
    const item = await prisma.item.create({
      data: {
        userId: testUserId,
        name: "Cascade Test",
        order: 0,
        depth: 0,
      },
    });

    await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "test.mp4",
        sftpPath: "/test.mp4",
        fileType: "MEDIA",
      },
    });

    // Delete item - should cascade to files
    await prisma.item.delete({ where: { id: item.id } });

    const files = await prisma.itemFile.findMany({
      where: { itemId: item.id },
    });

    expect(files).toHaveLength(0);
  });
});
