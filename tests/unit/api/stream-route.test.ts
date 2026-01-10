/**
 * Unit tests for /api/stream/[fileId] route.
 * Tests media streaming with Range header support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Readable } from "stream";

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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "@/app/api/stream/[fileId]/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDriveClient } from "@/lib/google-drive-client";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.itemFile.findUnique);
const mockGetDriveClient = vi.mocked(getDriveClient);

function createRequest(fileId: string, headers?: Record<string, string>) {
  return new NextRequest(`http://localhost/api/stream/${fileId}`, {
    headers: headers ? new Headers(headers) : undefined,
  });
}

function createMockNodeStream(data: string = "test-data") {
  const stream = new Readable({
    read() {
      this.push(Buffer.from(data));
      this.push(null);
    },
  });
  return stream;
}

describe("GET /api/stream/[fileId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 404 when file not found", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue(null);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("File not found");
  });

  it("returns 403 when user doesn't own item", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: BigInt(1000),
      item: {
        userId: "other-user",
        driveConnection: { id: "conn-1" },
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  it("returns 404 when no storage connection for file", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: null,
      mimeType: "video/mp4",
      size: null,
      item: {
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
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: BigInt(1000),
      item: {
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

  it("returns 206 with partial content for valid Range header", async () => {
    const fileSize = 10000;
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: BigInt(fileSize),
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    const mockStream = createMockNodeStream("partial-data");
    mockGetDriveClient.mockResolvedValue({
      files: {
        get: vi.fn().mockResolvedValue({ data: mockStream }),
      },
    } as never);

    const response = await GET(
      createRequest("file-123", { range: "bytes=0-999" }),
      { params: Promise.resolve({ fileId: "file-123" }) }
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Content-Range")).toBe(
      `bytes 0-999/${fileSize}`
    );
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe("1000");
  });

  it("returns 416 for invalid Range header", async () => {
    const fileSize = 1000;
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: BigInt(fileSize),
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    // Request range beyond file size
    const response = await GET(
      createRequest("file-123", { range: "bytes=2000-3000" }),
      { params: Promise.resolve({ fileId: "file-123" }) }
    );

    expect(response.status).toBe(416);
    expect(response.headers.get("Content-Range")).toBe(`bytes */${fileSize}`);
  });

  it("streams full file when no Range header provided", async () => {
    const fileSize = 5000;
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: BigInt(fileSize),
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    const mockStream = createMockNodeStream("full-file-data");
    mockGetDriveClient.mockResolvedValue({
      files: {
        get: vi.fn().mockResolvedValue({ data: mockStream }),
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Length")).toBe(String(fileSize));
  });

  it("infers MIME type from filename when not in database", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "audio.mp3",
      driveFileId: "drive-file-123",
      mimeType: null, // No MIME type in database
      size: BigInt(1000),
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    const mockStream = createMockNodeStream("audio-data");
    mockGetDriveClient.mockResolvedValue({
      files: {
        get: vi.fn().mockResolvedValue({ data: mockStream }),
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
  });

  it("uses application/octet-stream when MIME type cannot be determined", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "unknown.xyz", // Unknown extension
      driveFileId: "drive-file-123",
      mimeType: null,
      size: BigInt(1000),
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    const mockStream = createMockNodeStream("unknown-data");
    mockGetDriveClient.mockResolvedValue({
      files: {
        get: vi.fn().mockResolvedValue({ data: mockStream }),
      },
    } as never);

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream"
    );
  });

  it("streams full file when size is unknown (zero)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: null, // Unknown size
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    const mockStream = createMockNodeStream("video-data");
    mockGetDriveClient.mockResolvedValue({
      files: {
        get: vi.fn().mockResolvedValue({ data: mockStream }),
      },
    } as never);

    // Even with Range header, should ignore it when size is unknown
    const response = await GET(
      createRequest("file-123", { range: "bytes=0-999" }),
      { params: Promise.resolve({ fileId: "file-123" }) }
    );

    // Should return 200 (full file) not 206 (partial) since size is unknown
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
    expect(response.headers.get("Content-Length")).toBeNull();
  });

  it("returns 500 when Google Drive API fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      id: "file-123",
      filename: "video.mp4",
      driveFileId: "drive-file-123",
      mimeType: "video/mp4",
      size: BigInt(1000),
      item: {
        userId: "user-1",
        driveConnection: { id: "conn-1", needsReauth: false },
      },
    } as never);

    mockGetDriveClient.mockRejectedValue(new Error("Drive API error"));

    const response = await GET(createRequest("file-123"), {
      params: Promise.resolve({ fileId: "file-123" }),
    });

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Failed to stream file");
  });
});
