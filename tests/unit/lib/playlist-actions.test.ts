/**
 * Unit tests for playlist server actions.
 * Tests all CRUD operations with mocked Prisma, auth, and rate limiting.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";

// Mock @/lib/env
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    BYPASS_RATE_LIMIT: "true",
  },
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    playlist: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    playlistItem: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      updateMany: vi.fn(),
    },
    item: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((updates) => Promise.all(updates)),
  },
}));

// Mock rate-limit
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Mock tmdb-image-utils
vi.mock("@/lib/tmdb-image-utils", () => ({
  resolveArtworkId: vi.fn().mockReturnValue(null),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock errors
vi.mock("@/lib/errors", () => ({
  handlePrismaError: vi.fn().mockReturnValue(null),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock sharp (dynamic import)
vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    metadata: vi.fn().mockResolvedValue({ format: "jpeg" }),
    rotate: vi.fn().mockReturnValue({
      toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed")),
    }),
  }),
}));

// Mock colour extraction
vi.mock("@/lib/colour-extract", () => ({
  extractDominantColour: vi.fn().mockResolvedValue("#5c3a1a"),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolveArtworkId } from "@/lib/tmdb-image-utils";
import { extractDominantColour } from "@/lib/colour-extract";
import {
  createPlaylist,
  deletePlaylist,
  updatePlaylist,
  addItemToPlaylists,
  removeItemFromPlaylist,
  removeItemsFromPlaylist,
  reorderPlaylists,
  reorderPlaylistItems,
  getUserPlaylists,
  getPlaylist,
  getPlaylistsForItem,
  regenerateShareToken,
  updatePlaylistArtwork,
  removePlaylistArtwork,
} from "@/lib/playlist-actions";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockRateLimit = checkRateLimit as unknown as ReturnType<typeof vi.fn>;

/** Helper to create a mock session */
const mockSession = (userId: string): Session => ({
  user: { id: userId, email: "test@example.com" },
  expires: new Date().toISOString(),
});

describe("playlist-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(null);
  });

  describe("createPlaylist", () => {
    it("rejects unauthenticated user", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await createPlaylist("My Playlist");
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects when rate limited", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      mockRateLimit.mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });
      const result = await createPlaylist("My Playlist");
      expect(result.error).toBe("Too many attempts. Please try again later.");
    });

    it("rejects empty name", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const result = await createPlaylist("");
      expect(result.error).toBeDefined();
    });

    it("rejects whitespace-only name", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const result = await createPlaylist("   ");
      expect(result.error).toBeDefined();
    });

    it("creates playlist with correct order", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: 2 },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 3,
        userId: "user1",
      } as never);

      const result = await createPlaylist("My Playlist");
      expect(result.success).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual({ id: "pl1", name: "My Playlist" });
      }
      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "My Playlist",
            order: 3,
            userId: "user1",
          }),
        })
      );
    });

    it("starts order at 0 when no playlists exist", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "First Playlist",
        order: 0,
        userId: "user1",
      } as never);

      const result = await createPlaylist("First Playlist");
      expect(result.success).toBe(true);
      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 0 }),
        })
      );
    });
  });

  describe("updatePlaylist", () => {
    it("rejects unauthenticated user", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await updatePlaylist("pl1", { name: "Renamed" });
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects when rate limited", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      mockRateLimit.mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });
      const result = await updatePlaylist("pl1", { name: "Renamed" });
      expect(result.error).toBe("Too many attempts. Please try again later.");
    });

    it("rejects non-owner (playlist not found)", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null);
      const result = await updatePlaylist("pl1", { name: "Renamed" });
      expect(result.error).toBe("Playlist not found");
    });

    it("updates name successfully", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
        userId: "user1",
      } as never);
      vi.mocked(prisma.playlist.update).mockResolvedValue({} as never);

      const result = await updatePlaylist("pl1", { name: "Renamed" });
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith({
        where: { id: "pl1" },
        data: { name: "Renamed" },
      });
    });

    it("updates isPublic successfully", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
        userId: "user1",
      } as never);
      vi.mocked(prisma.playlist.update).mockResolvedValue({} as never);

      const result = await updatePlaylist("pl1", { isPublic: true });
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith({
        where: { id: "pl1" },
        data: { isPublic: true },
      });
    });

    it("sets description to null for empty string", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
        userId: "user1",
      } as never);
      vi.mocked(prisma.playlist.update).mockResolvedValue({} as never);

      const result = await updatePlaylist("pl1", { description: "" });
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith({
        where: { id: "pl1" },
        data: { description: null },
      });
    });

    it("rejects invalid name", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
        userId: "user1",
      } as never);

      const result = await updatePlaylist("pl1", { name: "a".repeat(256) });
      expect(result.error).toBeDefined();
    });
  });

  describe("deletePlaylist", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await deletePlaylist("pl1");
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects when rate limited", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      mockRateLimit.mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });
      const result = await deletePlaylist("pl1");
      expect(result.error).toBe("Too many attempts. Please try again later.");
    });

    it("rejects non-owner", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null);
      const result = await deletePlaylist("pl1");
      expect(result.error).toBe("Playlist not found");
    });

    it("deletes playlist successfully", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
        userId: "user1",
      } as never);
      vi.mocked(prisma.playlist.delete).mockResolvedValue({} as never);

      const result = await deletePlaylist("pl1");
      expect(result.success).toBe(true);
      expect(prisma.playlist.delete).toHaveBeenCalledWith({
        where: { id: "pl1" },
      });
    });
  });

  describe("addItemToPlaylists", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await addItemToPlaylists("item1", ["pl1"]);
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects when rate limited", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      mockRateLimit.mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });
      const result = await addItemToPlaylists("item1", ["pl1"]);
      expect(result.error).toBe("Too many attempts. Please try again later.");
    });

    it("returns success for empty playlistIds array", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const result = await addItemToPlaylists("item1", []);
      expect(result.success).toBe(true);
    });

    it("rejects when item not owned by user", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      const result = await addItemToPlaylists("item1", ["pl1"]);
      expect(result.error).toBe("Item not found");
    });

    it("rejects when playlist not owned by user", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item1",
      } as never);
      vi.mocked(prisma.playlist.findMany).mockResolvedValue([]);
      const result = await addItemToPlaylists("item1", ["pl1"]);
      expect(result.error).toBe("One or more playlists not found");
    });

    it("adds item to playlists with correct order", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "item1",
      } as never);
      vi.mocked(prisma.playlist.findMany).mockResolvedValue([
        { id: "pl1" },
        { id: "pl2" },
      ] as never);
      vi.mocked(prisma.playlistItem.aggregate)
        .mockResolvedValueOnce({ _max: { order: 2 } } as never)
        .mockResolvedValueOnce({ _max: { order: null } } as never);
      vi.mocked(prisma.playlistItem.createMany).mockResolvedValue({
        count: 2,
      } as never);

      const result = await addItemToPlaylists("item1", ["pl1", "pl2"]);
      expect(result.success).toBe(true);
      expect(prisma.playlistItem.createMany).toHaveBeenCalledWith({
        data: [
          { playlistId: "pl1", itemId: "item1", order: 3 },
          { playlistId: "pl2", itemId: "item1", order: 0 },
        ],
        skipDuplicates: true,
      });
    });
  });

  describe("removeItemFromPlaylist", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await removeItemFromPlaylist("pl1", "item1");
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects non-owner of playlist", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null);
      const result = await removeItemFromPlaylist("pl1", "item1");
      expect(result.error).toBe("Playlist not found");
    });

    it("removes item successfully", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
      } as never);
      vi.mocked(prisma.playlistItem.deleteMany).mockResolvedValue({
        count: 1,
      } as never);

      const result = await removeItemFromPlaylist("pl1", "item1");
      expect(result.success).toBe(true);
      expect(prisma.playlistItem.deleteMany).toHaveBeenCalledWith({
        where: { playlistId: "pl1", itemId: "item1" },
      });
    });
  });

  describe("removeItemsFromPlaylist", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await removeItemsFromPlaylist("pl1", ["item1"]);
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects when rate limited", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      mockRateLimit.mockResolvedValue({
        error: "Too many attempts. Please try again later.",
      });
      const result = await removeItemsFromPlaylist("pl1", ["item1"]);
      expect(result.error).toBe("Too many attempts. Please try again later.");
    });

    it("returns success for empty itemIds array", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const result = await removeItemsFromPlaylist("pl1", []);
      expect(result.success).toBe(true);
    });

    it("rejects non-owner of playlist", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null);
      const result = await removeItemsFromPlaylist("pl1", ["item1", "item2"]);
      expect(result.error).toBe("Playlist not found");
    });

    it("bulk removes items successfully", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
      } as never);
      vi.mocked(prisma.playlistItem.deleteMany).mockResolvedValue({
        count: 2,
      } as never);

      const result = await removeItemsFromPlaylist("pl1", ["item1", "item2"]);
      expect(result.success).toBe(true);
      expect(prisma.playlistItem.deleteMany).toHaveBeenCalledWith({
        where: { playlistId: "pl1", itemId: { in: ["item1", "item2"] } },
      });
    });
  });

  describe("reorderPlaylists", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await reorderPlaylists([{ id: "pl1", order: 0 }]);
      expect(result.error).toBe("Not authenticated");
    });

    it("returns success for empty updates", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const result = await reorderPlaylists([]);
      expect(result.success).toBe(true);
    });

    it("reorders playlists via $transaction", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.updateMany).mockResolvedValue({
        count: 1,
      } as never);

      const result = await reorderPlaylists([
        { id: "pl1", order: 1 },
        { id: "pl2", order: 0 },
      ]);
      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("reorderPlaylistItems", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await reorderPlaylistItems("pl1", []);
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects non-owner of playlist", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null);
      const result = await reorderPlaylistItems("pl1", [
        { id: "pi1", order: 0 },
      ]);
      expect(result.error).toBe("Playlist not found");
    });

    it("returns success for empty updates", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
      } as never);
      const result = await reorderPlaylistItems("pl1", []);
      expect(result.success).toBe(true);
    });

    it("reorders items via $transaction", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
      } as never);
      vi.mocked(prisma.playlistItem.updateMany).mockResolvedValue({
        count: 1,
      } as never);

      const result = await reorderPlaylistItems("pl1", [
        { id: "pi1", order: 1 },
        { id: "pi2", order: 0 },
      ]);
      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe("getUserPlaylists", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await getUserPlaylists();
      expect(result.error).toBe("Not authenticated");
    });

    it("returns playlists with counts and preview artwork", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(resolveArtworkId).mockReturnValue("artwork-1");
      vi.mocked(prisma.playlist.findMany).mockResolvedValue([
        {
          id: "pl1",
          name: "Watchlist",
          description: null,
          order: 0,
          isPublic: false,
          artworkUrl: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-01"),
          _count: { playlistItems: 3 },
          playlistItems: [
            { item: { id: "item1", tmdbPosterPath: "/poster.jpg", files: [] } },
          ],
        },
      ] as never);

      const result = await getUserPlaylists();
      expect(result.success).toBe(true);
      if ("data" in result) {
        expect(result.data).toHaveLength(1);
        expect(result.data![0].name).toBe("Watchlist");
        expect(result.data![0].itemCount).toBe(3);
        expect(result.data![0].previewPosters).toEqual([
          { tmdbPosterPath: "/poster.jpg", artworkId: "artwork-1" },
        ]);
      }
    });
  });

  describe("getPlaylist", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await getPlaylist("pl1");
      expect(result.error).toBe("Not authenticated");
    });

    it("returns error for non-owner", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue(null);
      const result = await getPlaylist("pl1");
      expect(result.error).toBe("Playlist not found");
    });

    it("returns playlist with mapped items", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(resolveArtworkId).mockReturnValue("artwork-1");
      vi.mocked(prisma.playlist.findFirst).mockResolvedValue({
        id: "pl1",
        name: "Watchlist",
        description: "My watchlist",
        order: 0,
        isPublic: false,
        artworkUrl: null,
        userId: "user1",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
        playlistItems: [
          {
            id: "pi1",
            order: 0,
            addedAt: new Date("2025-01-01"),
            item: {
              id: "item1",
              name: "Movie",
              tmdbPosterPath: "/poster.jpg",
              tmdbBackdropPath: null,
              files: [{ id: "f1", fileType: "ARTWORK", isPrimary: true }],
            },
          },
        ],
      } as never);

      const result = await getPlaylist("pl1");
      expect(result.success).toBe(true);
      if ("data" in result) {
        expect(result.data!.name).toBe("Watchlist");
        expect(result.data!.items).toHaveLength(1);
        expect(result.data!.items[0].playlistItemId).toBe("pi1");
        expect(result.data!.items[0].item.artworkId).toBe("artwork-1");
      }
    });
  });

  describe("getPlaylistsForItem", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await getPlaylistsForItem("item1");
      expect(result.error).toBe("Not authenticated");
    });

    it("returns membership data for playlists", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.findMany).mockResolvedValue([
        { id: "pl1", name: "Watchlist", playlistItems: [{ id: "pi1" }] },
        { id: "pl2", name: "Favourites", playlistItems: [] },
      ] as never);

      const result = await getPlaylistsForItem("item1");
      expect(result.success).toBe(true);
      if ("data" in result) {
        expect(result.data).toEqual([
          { id: "pl1", name: "Watchlist", isMember: true },
          { id: "pl2", name: "Favourites", isMember: false },
        ]);
      }
    });
  });

  describe("createPlaylist share token and itemIds", () => {
    it("does not generate shareToken for private playlists", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 0,
        userId: "user1",
        shareToken: null,
      } as never);

      const result = await createPlaylist("My Playlist");
      expect(result.success).toBe(true);
      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: null,
          }),
        })
      );
    });

    it("generates shareToken for unlisted playlists", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 0,
        userId: "user1",
        shareToken: "abc123",
      } as never);

      const result = await createPlaylist("My Playlist", {
        visibility: "unlisted",
      });
      expect(result.success).toBe(true);
      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: expect.any(String),
            isPublic: false,
          }),
        })
      );
    });

    it("generates shareToken for public playlists", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 0,
        userId: "user1",
        shareToken: "abc123",
      } as never);

      const result = await createPlaylist("My Playlist", {
        visibility: "public",
      });
      expect(result.success).toBe(true);
      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: expect.any(String),
            isPublic: true,
          }),
        })
      );
    });

    it("creates PlaylistItem rows when itemIds provided", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
        if (typeof fn === "function") {
          return fn(prisma);
        }
        return fn;
      });
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 0,
        userId: "user1",
        shareToken: null,
      } as never);
      vi.mocked(prisma.item.count).mockResolvedValue(2);
      vi.mocked(prisma.playlistItem.createMany).mockResolvedValue({
        count: 2,
      } as never);

      const result = await createPlaylist("My Playlist", {
        itemIds: ["item-1", "item-2"],
      });

      expect(result.success).toBe(true);
      expect(prisma.playlistItem.createMany).toHaveBeenCalledWith({
        data: [
          { playlistId: "pl1", itemId: "item-1", order: 0 },
          { playlistId: "pl1", itemId: "item-2", order: 1 },
        ],
      });
    });

    it("rejects itemIds not owned by user", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
        if (typeof fn === "function") {
          return fn(prisma);
        }
        return fn;
      });
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 0,
        userId: "user1",
        shareToken: null,
      } as never);
      // Only 1 of 2 items belongs to user
      vi.mocked(prisma.item.count).mockResolvedValue(1);

      const result = await createPlaylist("My Playlist", {
        itemIds: ["item-1", "item-2"],
      });

      expect(result.error).toBeDefined();
    });

    it("handles empty itemIds array", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: null },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 0,
        userId: "user1",
        shareToken: null,
      } as never);

      const result = await createPlaylist("My Playlist", { itemIds: [] });
      expect(result.success).toBe(true);
    });
  });

  describe("createPlaylist with options", () => {
    it("creates playlist with description and public visibility", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.aggregate).mockResolvedValue({
        _max: { order: 0 },
      } as never);
      vi.mocked(prisma.playlist.create).mockResolvedValue({
        id: "pl1",
        name: "My Playlist",
        order: 1,
        userId: "user1",
        shareToken: "abc123",
      } as never);

      const result = await createPlaylist("My Playlist", {
        description: "A test playlist",
        visibility: "public",
      });
      expect(result.success).toBe(true);
      expect(prisma.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "My Playlist",
            description: "A test playlist",
            isPublic: true,
            shareToken: expect.any(String),
          }),
        })
      );
    });
  });

  describe("updatePlaylist with sharing", () => {
    it("generates share token when enableSharing=true", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const result = await updatePlaylist("pl1", { enableSharing: true });
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: expect.any(String),
          }),
        })
      );
    });

    it("revokes share token when enableSharing=false", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const result = await updatePlaylist("pl1", { enableSharing: false });
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: null,
          }),
        })
      );
    });
  });

  describe("regenerateShareToken", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await regenerateShareToken("pl1");
      expect(result.error).toBe("Not authenticated");
    });

    it("generates new share token", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
        shareToken: "new-token-123",
      } as never);

      const result = await regenerateShareToken("pl1");
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shareToken: expect.any(String),
          }),
        })
      );
    });
  });

  describe("updatePlaylistArtwork", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const formData = new FormData();
      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.error).toBe("Not authenticated");
    });

    it("rejects when no file provided", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const formData = new FormData();
      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.error).toBe("No file provided");
    });

    it("rejects file that is too large", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const formData = new FormData();
      const largeFile = new File(
        [new ArrayBuffer(3 * 1024 * 1024)],
        "large.jpg",
        { type: "image/jpeg" }
      );
      formData.append("artwork", largeFile);

      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.error).toBeDefined();
    });

    it("rejects invalid MIME type", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      const formData = new FormData();
      const file = new File(["data"], "test.gif", { type: "image/gif" });
      formData.append("artwork", file);

      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.error).toBeDefined();
    });

    it("uploads valid artwork", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const formData = new FormData();
      const file = new File([imageBytes], "cover.jpg", {
        type: "image/jpeg",
      });
      // Polyfill arrayBuffer for jsdom File
      if (!file.arrayBuffer) {
        file.arrayBuffer = () =>
          Promise.resolve(imageBytes.buffer as ArrayBuffer);
      }
      formData.append("artwork", file);

      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            artworkImage: expect.any(Uint8Array),
            artworkMime: "image/jpeg",
          }),
        })
      );
    });

    it("extracts dominant colour from uploaded artwork", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const formData = new FormData();
      const file = new File([imageBytes], "cover.jpg", {
        type: "image/jpeg",
      });
      if (!file.arrayBuffer) {
        file.arrayBuffer = () =>
          Promise.resolve(imageBytes.buffer as ArrayBuffer);
      }
      formData.append("artwork", file);

      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.success).toBe(true);
      expect(extractDominantColour).toHaveBeenCalled();
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dominantColour: "#5c3a1a",
          }),
        })
      );
    });

    it("saves artwork with null colour when extraction throws", async () => {
      vi.mocked(extractDominantColour).mockRejectedValue(
        new Error("sharp processing failed")
      );
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
      const formData = new FormData();
      const file = new File([imageBytes], "cover.jpg", {
        type: "image/jpeg",
      });
      if (!file.arrayBuffer) {
        file.arrayBuffer = () =>
          Promise.resolve(imageBytes.buffer as ArrayBuffer);
      }
      formData.append("artwork", file);

      const result = await updatePlaylistArtwork("pl1", formData);
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dominantColour: null,
          }),
        })
      );
    });
  });

  describe("removePlaylistArtwork", () => {
    it("rejects unauthenticated", async () => {
      mockAuth.mockResolvedValue(null);
      const result = await removePlaylistArtwork("pl1");
      expect(result.error).toBe("Not authenticated");
    });

    it("removes artwork successfully", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const result = await removePlaylistArtwork("pl1");
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            artworkImage: null,
            artworkMime: null,
          }),
        })
      );
    });

    it("clears dominant colour when artwork is removed", async () => {
      mockAuth.mockResolvedValue(mockSession("user1"));
      vi.mocked(prisma.playlist.update).mockResolvedValue({
        id: "pl1",
      } as never);

      const result = await removePlaylistArtwork("pl1");
      expect(result.success).toBe(true);
      expect(prisma.playlist.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dominantColour: null,
          }),
        })
      );
    });
  });
});
