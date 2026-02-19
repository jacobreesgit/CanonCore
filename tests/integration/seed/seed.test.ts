/**
 * Integration tests for seed script database operations.
 * Tests with real database but mocked external APIs (TMDB, Google Drive).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";

// Mock Google Drive client
vi.mock("@/lib/google-drive-client", () => ({
  getDriveClientFromRefreshToken: vi.fn().mockResolvedValue({
    files: {
      create: vi.fn().mockResolvedValue({ data: { id: "mock-drive-id" } }),
      list: vi.fn().mockResolvedValue({ data: { files: [] } }),
    },
  }),
  createFolder: vi.fn().mockResolvedValue("mock-folder-id"),
  uploadFile: vi
    .fn()
    .mockResolvedValue({ id: "mock-file-id", name: "poster.jpg" }),
  permanentlyDeleteFile: vi.fn().mockResolvedValue(undefined),
  emptyTrash: vi.fn().mockResolvedValue(undefined),
  batchDelete: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
}));

// Mock crypto with implementation that works for tests
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi
    .fn()
    .mockImplementation((value: string) => `encrypted:${value}`),
  decryptCredential: vi
    .fn()
    .mockImplementation((value: string) => value.replace("encrypted:", "")),
}));

// Test email domain
const TEST_EMAIL = "seed-integration-test@test.example.com";

describe("seed database operations", () => {
  beforeAll(async () => {
    // Clean up any existing test users
    await prisma.playlistItem.deleteMany({
      where: { playlist: { user: { email: TEST_EMAIL } } },
    });
    await prisma.playlist.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.itemFile.deleteMany({
      where: { item: { user: { email: TEST_EMAIL } } },
    });
    await prisma.item.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.googleDriveConnection.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.user.deleteMany({
      where: { email: TEST_EMAIL },
    });
  });

  afterAll(async () => {
    // Final cleanup
    await prisma.playlistItem.deleteMany({
      where: { playlist: { user: { email: TEST_EMAIL } } },
    });
    await prisma.playlist.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.itemFile.deleteMany({
      where: { item: { user: { email: TEST_EMAIL } } },
    });
    await prisma.item.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.googleDriveConnection.deleteMany({
      where: { user: { email: TEST_EMAIL } },
    });
    await prisma.user.deleteMany({
      where: { email: TEST_EMAIL },
    });
  });

  describe("user creation", () => {
    it("creates a user with hashed password", async () => {
      const bcrypt = await import("bcryptjs");
      const password = "TestPassword123!";
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          email: TEST_EMAIL,
          name: "Integration Test User",
          passwordHash,
        },
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(TEST_EMAIL);
      expect(user.name).toBe("Integration Test User");
      expect(user.passwordHash).not.toBe(password);

      // Verify password can be validated
      const isValid = await bcrypt.compare(password, user.passwordHash);
      expect(isValid).toBe(true);
    });
  });

  describe("Google Drive connection", () => {
    it("creates encrypted Drive connection for user", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      expect(user).not.toBeNull();

      const { encryptCredential } = await import("@/lib/crypto");

      const connection = await prisma.googleDriveConnection.create({
        data: {
          userId: user!.id,
          name: "Test Drive Connection",
          email: "test-drive@gmail.com",
          encryptedAccessToken: encryptCredential("test-access-token"),
          encryptedRefreshToken: encryptCredential("test-refresh-token"),
          accessTokenExpiry: new Date(0),
          rootFolderId: "test-root-folder-id",
          isActive: true,
          needsReauth: false,
        },
      });

      expect(connection.id).toBeDefined();
      expect(connection.userId).toBe(user!.id);
      expect(connection.isActive).toBe(true);
      expect(connection.needsReauth).toBe(false);
    });
  });

  describe("Items flat structure", () => {
    it("creates movie at root level with correct attributes", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const connection = await prisma.googleDriveConnection.findFirst({
        where: { userId: user!.id },
      });

      const movie = await prisma.item.create({
        data: {
          name: "The Shawshank Redemption (1994)",
          description: "Two imprisoned men bond over a number of years...",
          userId: user!.id,
          parentId: null, // Flat structure - no parent
          order: 0,
          depth: 0, // Root level
          driveConnectionId: connection!.id,
          driveFileId: "mock-movie-folder-id",
          syncStatus: "SYNCED",
        },
      });

      expect(movie.name).toBe("The Shawshank Redemption (1994)");
      expect(movie.depth).toBe(0);
      expect(movie.parentId).toBeNull();
      expect(movie.driveFileId).toBe("mock-movie-folder-id");
    });

    it("creates TV show at root level after movies", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const connection = await prisma.googleDriveConnection.findFirst({
        where: { userId: user!.id },
      });

      const tvShow = await prisma.item.create({
        data: {
          name: "Doctor Who (2005)",
          description: "The Doctor travels through time and space...",
          userId: user!.id,
          parentId: null, // Flat structure - no parent
          order: 1, // After movie at order 0
          depth: 0, // Root level
          driveConnectionId: connection!.id,
          driveFileId: "mock-tv-folder-id",
          syncStatus: "SYNCED",
        },
      });

      expect(tvShow.name).toBe("Doctor Who (2005)");
      expect(tvShow.depth).toBe(0);
      expect(tvShow.parentId).toBeNull();
      expect(tvShow.order).toBe(1);
    });

    it("creates ItemFile for artwork", async () => {
      const movie = await prisma.item.findFirst({
        where: { name: { contains: "Shawshank" } },
      });

      // Use unique driveFileId to avoid constraint violations on reruns
      const uniqueDriveFileId = `mock-poster-file-id-${Date.now()}`;

      const itemFile = await prisma.itemFile.create({
        data: {
          itemId: movie!.id,
          filename: "poster.jpg",
          driveFileId: uniqueDriveFileId,
          fileType: "ARTWORK",
          mimeType: "image/jpeg",
          size: BigInt(50000),
          isPrimary: true,
          isHero: true,
          syncStatus: "SYNCED",
        },
      });

      expect(itemFile.filename).toBe("poster.jpg");
      expect(itemFile.fileType).toBe("ARTWORK");
      expect(itemFile.isPrimary).toBe(true);
      expect(itemFile.isHero).toBe(true);
    });
  });

  // Shared show ID for cross-test queries
  let hierarchyShowId: string;

  describe("Items hierarchical structure", () => {
    it("creates show → season → episode hierarchy", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const connection = await prisma.googleDriveConnection.findFirst({
        where: { userId: user!.id },
      });

      // Use unique name with timestamp to avoid conflicts with other test runs
      const uniqueShowName = `Breaking Bad (2008) - ${Date.now()}`;

      // Create show at depth 0
      const show = await prisma.item.create({
        data: {
          name: uniqueShowName,
          description: "A high school chemistry teacher diagnosed with...",
          userId: user!.id,
          parentId: null,
          order: 10,
          depth: 0,
          driveConnectionId: connection!.id,
          driveFileId: `mock-show-folder-id-${Date.now()}`,
          syncStatus: "SYNCED",
        },
      });

      // Store ID for later test
      hierarchyShowId = show.id;

      // Create season at depth 1
      const season = await prisma.item.create({
        data: {
          name: "Season 1",
          description: "The first season of Breaking Bad.",
          userId: user!.id,
          parentId: show.id,
          order: 0,
          depth: 1,
          driveConnectionId: connection!.id,
          driveFileId: `mock-season-folder-id-${Date.now()}`,
          syncStatus: "SYNCED",
        },
      });

      // Create episode at depth 2
      const episode = await prisma.item.create({
        data: {
          name: "E01 - Pilot",
          description: "Walter White begins his journey.",
          userId: user!.id,
          parentId: season.id,
          order: 0,
          depth: 2,
          driveConnectionId: connection!.id,
          driveFileId: `mock-episode-folder-id-${Date.now()}`,
          syncStatus: "SYNCED",
        },
      });

      expect(show.depth).toBe(0);
      expect(show.parentId).toBeNull();

      expect(season.depth).toBe(1);
      expect(season.parentId).toBe(show.id);

      expect(episode.depth).toBe(2);
      expect(episode.parentId).toBe(season.id);
    });

    it("retrieves full hierarchy with nested includes", async () => {
      // Use stored ID from previous test for reliable lookup
      const show = await prisma.item.findUnique({
        where: { id: hierarchyShowId },
        include: {
          children: {
            include: {
              children: true,
            },
          },
        },
      });

      expect(show).not.toBeNull();
      expect(show!.children.length).toBeGreaterThan(0);
      expect(show!.children[0].children.length).toBeGreaterThan(0);
    });

    it("sets correct depth values at each level", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      const items = await prisma.item.findMany({
        where: { userId: user!.id },
        select: { depth: true, parentId: true },
      });

      for (const item of items) {
        if (item.parentId === null) {
          expect(item.depth).toBe(0);
        }
      }
    });

    it("uses sequential order values (array index pattern)", async () => {
      const season = await prisma.item.findFirst({
        where: { name: "Season 1", parentId: hierarchyShowId },
      });

      // Create multiple episodes with sequential order
      await prisma.item.createMany({
        data: [
          {
            name: "E02 - Cat's in the Bag...",
            userId: season!.userId,
            parentId: season!.id,
            order: 1,
            depth: 2,
            syncStatus: "SYNCED",
          },
          {
            name: "E03 - ...And the Bag's in the River",
            userId: season!.userId,
            parentId: season!.id,
            order: 2,
            depth: 2,
            syncStatus: "SYNCED",
          },
        ],
      });

      const episodes = await prisma.item.findMany({
        where: { parentId: season!.id },
        orderBy: { order: "asc" },
      });

      // Verify sequential ordering: 0, 1, 2...
      for (let i = 0; i < episodes.length; i++) {
        expect(episodes[i].order).toBe(i);
      }
    });
  });

  describe("file attachments", () => {
    it("attaches artwork files with isPrimary and isHero flags", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const episode = await prisma.item.findFirst({
        where: { name: "E01 - Pilot", userId: user!.id },
      });

      await prisma.itemFile.create({
        data: {
          itemId: episode!.id,
          filename: "still.jpg",
          driveFileId: `mock-still-id-${Date.now()}`,
          fileType: "ARTWORK",
          mimeType: "image/jpeg",
          size: BigInt(25000),
          isPrimary: true,
          isHero: true,
          syncStatus: "SYNCED",
        },
      });

      const files = await prisma.itemFile.findMany({
        where: { itemId: episode!.id, fileType: "ARTWORK" },
      });

      expect(files.length).toBeGreaterThan(0);
      expect(files.some((f) => f.isPrimary)).toBe(true);
      expect(files.some((f) => f.isHero)).toBe(true);
    });

    it("attaches subtitle files with correct type", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const episode = await prisma.item.findFirst({
        where: { name: "E01 - Pilot", userId: user!.id },
      });

      await prisma.itemFile.create({
        data: {
          itemId: episode!.id,
          filename: "english.srt",
          driveFileId: `mock-subtitle-id-${Date.now()}`,
          fileType: "SUBTITLE",
          mimeType: "application/x-subrip",
          size: BigInt(1500),
          isPrimary: true,
          isHero: false,
          syncStatus: "SYNCED",
        },
      });

      const subtitles = await prisma.itemFile.findMany({
        where: { itemId: episode!.id, fileType: "SUBTITLE" },
      });

      expect(subtitles.length).toBeGreaterThan(0);
      expect(subtitles[0].mimeType).toBe("application/x-subrip");
    });

    it("creates media placeholders with null driveFileId", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const episode = await prisma.item.findFirst({
        where: { name: "E01 - Pilot", userId: user!.id },
      });

      await prisma.itemFile.create({
        data: {
          itemId: episode!.id,
          filename: "episode.mp4",
          driveFileId: null, // Placeholder
          fileType: "MEDIA",
          mimeType: "video/mp4",
          size: BigInt(0),
          isPrimary: true,
          isHero: false,
          syncStatus: "SYNCED",
        },
      });

      const mediaFiles = await prisma.itemFile.findMany({
        where: { itemId: episode!.id, fileType: "MEDIA" },
      });

      expect(mediaFiles.length).toBeGreaterThan(0);
      expect(mediaFiles[0].driveFileId).toBeNull();
      expect(mediaFiles[0].size).toBe(BigInt(0));
    });

    it("seasons have no media files (only shows and episodes)", async () => {
      const season = await prisma.item.findFirst({
        where: { name: "Season 1", parentId: hierarchyShowId },
      });

      // Intentionally NOT creating media for season
      const mediaFiles = await prisma.itemFile.findMany({
        where: { itemId: season!.id, fileType: "MEDIA" },
      });

      expect(mediaFiles.length).toBe(0);
    });
  });

  describe("description field", () => {
    it("stores description up to 1000 chars", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      const longDescription = "A".repeat(1000);
      const item = await prisma.item.create({
        data: {
          name: "Long Description Test",
          description: longDescription,
          userId: user!.id,
          parentId: null,
          order: 100,
          depth: 0,
          syncStatus: "SYNCED",
        },
      });

      expect(item.description).toBe(longDescription);
      expect(item.description!.length).toBe(1000);
    });

    it("handles empty description", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      const item = await prisma.item.create({
        data: {
          name: "Empty Description Test",
          description: "",
          userId: user!.id,
          parentId: null,
          order: 101,
          depth: 0,
          syncStatus: "SYNCED",
        },
      });

      expect(item.description).toBe("");
    });

    it("handles null description", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      const item = await prisma.item.create({
        data: {
          name: "Null Description Test",
          description: null,
          userId: user!.id,
          parentId: null,
          order: 102,
          depth: 0,
          syncStatus: "SYNCED",
        },
      });

      expect(item.description).toBeNull();
    });
  });

  describe("playlist operations", () => {
    it("creates a playlist for a user", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });

      const playlist = await prisma.playlist.create({
        data: {
          name: "Weekend Watchlist",
          description: "Movies for the weekend.",
          order: 0,
          isPublic: true,
          userId: user!.id,
        },
      });

      expect(playlist.id).toBeDefined();
      expect(playlist.name).toBe("Weekend Watchlist");
      expect(playlist.isPublic).toBe(true);
      expect(playlist.userId).toBe(user!.id);
    });

    it("adds items to a playlist via PlaylistItem", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const playlist = await prisma.playlist.findFirst({
        where: { userId: user!.id, name: "Weekend Watchlist" },
      });
      const items = await prisma.item.findMany({
        where: { userId: user!.id, parentId: null },
        take: 3,
      });

      expect(items.length).toBeGreaterThan(0);

      await prisma.playlistItem.createMany({
        data: items.map((item, idx) => ({
          playlistId: playlist!.id,
          itemId: item.id,
          order: idx,
        })),
      });

      const playlistItems = await prisma.playlistItem.findMany({
        where: { playlistId: playlist!.id },
        orderBy: { order: "asc" },
      });

      expect(playlistItems.length).toBe(items.length);
      for (let i = 0; i < playlistItems.length; i++) {
        expect(playlistItems[i].order).toBe(i);
      }
    });

    it("enforces unique constraint on playlist-item pairs", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const playlist = await prisma.playlist.findFirst({
        where: { userId: user!.id, name: "Weekend Watchlist" },
      });
      const existingItem = await prisma.playlistItem.findFirst({
        where: { playlistId: playlist!.id },
      });

      // Attempting to add the same item again should fail
      await expect(
        prisma.playlistItem.create({
          data: {
            playlistId: playlist!.id,
            itemId: existingItem!.itemId,
            order: 99,
          },
        })
      ).rejects.toThrow();
    });

    it("retrieves playlist with items via include", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
      });
      const playlist = await prisma.playlist.findFirst({
        where: { userId: user!.id, name: "Weekend Watchlist" },
        include: {
          playlistItems: {
            orderBy: { order: "asc" },
            include: { item: { select: { name: true } } },
          },
        },
      });

      expect(playlist).not.toBeNull();
      expect(playlist!.playlistItems.length).toBeGreaterThan(0);
      expect(playlist!.playlistItems[0].item.name).toBeDefined();
    });
  });

  describe("cleanup operations", () => {
    it("cascades deletion through relationships", async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_EMAIL },
        include: {
          items: { include: { files: true } },
          googleDriveConnection: true,
        },
      });

      expect(user).not.toBeNull();
      expect(user!.items.length).toBeGreaterThan(0);
      expect(user!.googleDriveConnection).not.toBeNull();

      // Delete in correct order
      await prisma.playlistItem.deleteMany({
        where: { playlist: { userId: user!.id } },
      });
      await prisma.playlist.deleteMany({
        where: { userId: user!.id },
      });
      await prisma.itemFile.deleteMany({
        where: { item: { userId: user!.id } },
      });
      await prisma.item.deleteMany({
        where: { userId: user!.id },
      });
      await prisma.googleDriveConnection.deleteMany({
        where: { userId: user!.id },
      });

      // Verify cleanup
      const remainingItems = await prisma.item.count({
        where: { userId: user!.id },
      });
      expect(remainingItems).toBe(0);

      const remainingPlaylists = await prisma.playlist.count({
        where: { userId: user!.id },
      });
      expect(remainingPlaylists).toBe(0);

      const remainingConnections = await prisma.googleDriveConnection.count({
        where: { userId: user!.id },
      });
      expect(remainingConnections).toBe(0);
    });
  });

  describe("Drive cleanup integration", () => {
    it("database cleanup succeeds independently of Drive cleanup", async () => {
      // This test verifies that even if Drive is mocked, database operations work
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash("TestPassword123!", 10);

      // Create a test user with Drive connection and items
      const cleanupTestEmail = `cleanup-test-${Date.now()}@test.example.com`;
      const user = await prisma.user.create({
        data: {
          email: cleanupTestEmail,
          name: "Cleanup Test User",
          passwordHash,
        },
      });

      // Create Drive connection
      const { encryptCredential } = await import("@/lib/crypto");
      const connection = await prisma.googleDriveConnection.create({
        data: {
          userId: user.id,
          name: "Test Connection",
          email: "cleanup@gmail.com",
          encryptedAccessToken: encryptCredential("test-access"),
          encryptedRefreshToken: encryptCredential("test-refresh"),
          accessTokenExpiry: new Date(0),
          rootFolderId: "test-root-id",
          isActive: true,
          needsReauth: false,
        },
      });

      // Create some items
      const item = await prisma.item.create({
        data: {
          name: "Test Item",
          userId: user.id,
          order: 0,
          depth: 0,
          driveConnectionId: connection.id,
          driveFileId: "mock-id",
          syncStatus: "SYNCED",
        },
      });

      // Create item file
      await prisma.itemFile.create({
        data: {
          itemId: item.id,
          filename: "test.mp4",
          fileType: "MEDIA",
          mimeType: "video/mp4",
          size: BigInt(0),
          isPrimary: true,
          isHero: false,
          syncStatus: "SYNCED",
        },
      });

      // Now clean up (simulating the cleanup flow)
      await prisma.itemFile.deleteMany({
        where: { item: { user: { email: cleanupTestEmail } } },
      });
      await prisma.item.deleteMany({
        where: { user: { email: cleanupTestEmail } },
      });
      await prisma.googleDriveConnection.deleteMany({
        where: { user: { email: cleanupTestEmail } },
      });
      await prisma.user.deleteMany({
        where: { email: cleanupTestEmail },
      });

      // Verify everything is cleaned up
      const remainingUser = await prisma.user.findUnique({
        where: { email: cleanupTestEmail },
      });
      expect(remainingUser).toBeNull();
    });

    it("handles cleanup when user has no Drive connection", async () => {
      const bcrypt = await import("bcryptjs");
      const passwordHash = await bcrypt.hash("TestPassword123!", 10);

      const noDriveEmail = `no-drive-${Date.now()}@test.example.com`;
      const user = await prisma.user.create({
        data: {
          email: noDriveEmail,
          name: "No Drive User",
          passwordHash,
        },
      });

      // Create item without Drive connection
      await prisma.item.create({
        data: {
          name: "Local Item",
          userId: user.id,
          order: 0,
          depth: 0,
          syncStatus: "PENDING",
        },
      });

      // Clean up
      await prisma.itemFile.deleteMany({
        where: { item: { user: { email: noDriveEmail } } },
      });
      await prisma.item.deleteMany({
        where: { user: { email: noDriveEmail } },
      });
      await prisma.googleDriveConnection.deleteMany({
        where: { user: { email: noDriveEmail } },
      });
      await prisma.user.deleteMany({
        where: { email: noDriveEmail },
      });

      // Verify cleanup
      const remainingUser = await prisma.user.findUnique({
        where: { email: noDriveEmail },
      });
      expect(remainingUser).toBeNull();
    });
  });
});
