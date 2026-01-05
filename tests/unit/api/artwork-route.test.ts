/**
 * Unit tests for /api/artwork/[fileId] route.
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

vi.mock("@/lib/sftp-client", () => ({
  downloadFileBuffer: vi.fn(),
}));

vi.mock("@/lib/sftp-utils", () => ({
  isValidPath: vi.fn().mockReturnValue(true),
}));

import { GET } from "@/app/api/artwork/[fileId]/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { downloadFileBuffer } from "@/lib/sftp-client";
import { isValidPath } from "@/lib/sftp-utils";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.itemFile.findUnique);
const mockDownload = vi.mocked(downloadFileBuffer);
const mockValidPath = vi.mocked(isValidPath);

function createRequest(fileId: string) {
  return new NextRequest(`http://localhost/api/artwork/${fileId}`);
}

describe("GET /api/artwork/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidPath.mockReturnValue(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when file not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 403 when user doesn't own item", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "other-user",
        connection: { id: "conn-1" },
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
      sftpPath: "/media/video.mp4",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 501 when no connection configured", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      size: null,
      item: {
        userId: "user-1",
        connection: null,
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(501);
  });

  it("returns 400 for path traversal attempt", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/../../../etc/passwd",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);
    mockValidPath.mockReturnValue(false);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(400);
    expect(mockValidPath).toHaveBeenCalledWith("/../../../etc/passwd");
  });

  it("returns 413 when known file size exceeds limit", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/huge.jpg",
      mimeType: "image/jpeg",
      size: BigInt(20 * 1024 * 1024), // 20MB
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(413);
  });

  it("returns image buffer on success", async () => {
    const imageBuffer = Buffer.from("fake-image-data");

    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1", host: "sftp.example.com" },
      },
    } as never);
    mockDownload.mockResolvedValue(imageBuffer);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("max-age=3600");

    const body = await response.arrayBuffer();
    expect(Buffer.from(body)).toEqual(imageBuffer);
  });

  it("returns 404 when SFTP file not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/missing.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);
    mockDownload.mockRejectedValue(new Error("No such file"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 504 on SFTP timeout", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);
    mockDownload.mockRejectedValue(new Error("Operation timeout"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(504);
  });

  it("returns 502 on generic SFTP error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/poster.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);
    mockDownload.mockRejectedValue(new Error("Connection reset"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(502);
  });

  it("returns 403 on SFTP permission denied", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      fileType: "ARTWORK",
      sftpPath: "/artwork/protected.jpg",
      mimeType: "image/jpeg",
      size: null,
      item: {
        userId: "user-1",
        connection: { id: "conn-1" },
      },
    } as never);
    mockDownload.mockRejectedValue(new Error("Permission denied"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(403);
  });
});
