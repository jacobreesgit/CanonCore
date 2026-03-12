/**
 * Unit tests for /api/artwork/[fileId] route.
 * Tests both authenticated (owner) and public access paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    itemFile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/google-drive-client", () => ({
  getDriveClient: vi.fn(),
  withRateLimit: vi.fn((fn) => fn()),
}));

vi.mock("@/lib/public-auth", () => ({
  isItemFullyPublic: vi.fn(),
}));

import { GET } from "@/app/api/artwork/[fileId]/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isItemFullyPublic } from "@/lib/public-auth";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.itemFile.findUnique);
const mockIsItemFullyPublic = vi.mocked(isItemFullyPublic);

function createRequest(fileId: string) {
  return new NextRequest(`http://localhost/api/artwork/${fileId}`);
}

describe("GET /api/artwork/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when file not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(404);
  });

  describe("private items (not fully public)", () => {
    beforeEach(() => {
      mockIsItemFullyPublic.mockResolvedValue(false);
    });

    it("returns 401 when not authenticated for private item", async () => {
      mockAuth.mockResolvedValue(null as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "ARTWORK",
        driveFileId: "drive-file-123",
        mimeType: "image/jpeg",
        size: null,
        item: {
          id: "item-123",
          userId: "user-1",
          driveConnection: { id: "conn-1" },
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 403 when user doesn't own item", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "ARTWORK",
        driveFileId: "drive-file-123",
        mimeType: "image/jpeg",
        size: null,
        item: {
          id: "item-123",
          userId: "other-user",
          driveConnection: { id: "conn-1" },
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      expect(response.status).toBe(403);
    });

    it("returns 400 when file is not artwork type", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "MEDIA",
        driveFileId: "drive-file-123",
        size: null,
        item: {
          id: "item-123",
          userId: "user-1",
          driveConnection: { id: "conn-1" },
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      expect(response.status).toBe(400);
    });

    it("returns 404 when no storage connection configured", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "ARTWORK",
        driveFileId: null,
        size: null,
        item: {
          id: "item-123",
          userId: "user-1",
          driveConnection: null,
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("No storage connection for file");
    });

    it("returns 401 when Google Drive needs reauth", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "ARTWORK",
        driveFileId: "drive-file-123",
        mimeType: "image/jpeg",
        size: null,
        item: {
          id: "item-123",
          userId: "user-1",
          driveConnection: { id: "conn-1", needsReauth: true },
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      expect(response.status).toBe(401);
      expect(await response.text()).toBe("Reconnect Google Drive");
    });
  });

  describe("public items (fully public)", () => {
    beforeEach(() => {
      mockIsItemFullyPublic.mockResolvedValue(true);
    });

    it("allows access without authentication for public item", async () => {
      mockAuth.mockResolvedValue(null as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "ARTWORK",
        driveFileId: "drive-file-123",
        mimeType: "image/jpeg",
        size: null,
        item: {
          id: "item-123",
          userId: "user-1",
          driveConnection: { id: "conn-1", needsReauth: true },
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      // Should fail at drive reconnect, not auth
      expect(response.status).toBe(401);
      expect(await response.text()).toBe("Reconnect Google Drive");
    });

    it("allows access from non-owner for public item", async () => {
      mockAuth.mockResolvedValue({ user: { id: "other-user" } } as never);
      mockFindUnique.mockResolvedValue({
        id: "file-123",
        fileType: "ARTWORK",
        driveFileId: "drive-file-123",
        mimeType: "image/jpeg",
        size: null,
        item: {
          id: "item-123",
          userId: "user-1",
          driveConnection: { id: "conn-1", needsReauth: true },
        },
      } as never);

      const response = await GET(createRequest("file-123"), {
        params: Promise.resolve({ fileId: "file-123" }),
      });

      // Should fail at drive reconnect, not auth
      expect(response.status).toBe(401);
      expect(await response.text()).toBe("Reconnect Google Drive");
    });
  });
});
