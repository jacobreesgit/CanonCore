/**
 * Unit tests for /api/user/avatar route.
 * Tests avatar image retrieval with authentication.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { GET } from "@/app/api/user/avatar/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.user.findUnique);

/** Create a mock NextRequest for testing */
function createMockRequest(params?: URLSearchParams): NextRequest {
  const url = new URL("http://localhost/api/user/avatar");
  if (params) {
    params.forEach((value, key) => url.searchParams.set(key, value));
  }
  return new NextRequest(url);
}

describe("GET /api/user/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when user has no avatar image", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      image: null,
      imageMime: null,
    } as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(404);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { image: true, imageMime: true },
    });
  });

  it("returns 404 when user has image but no MIME type", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      image: Buffer.from("fake-image"),
      imageMime: null,
    } as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(404);
  });

  it("returns image with correct headers when avatar exists", async () => {
    const imageData = Buffer.from("fake-png-image-data");
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      image: imageData,
      imageMime: "image/png",
    } as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("ETag")).toBeTruthy();
  });

  it("returns consistent ETag for same image content", async () => {
    const imageData = Buffer.from("consistent-image-data");
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      image: imageData,
      imageMime: "image/jpeg",
    } as never);

    const response1 = await GET(createMockRequest());
    const response2 = await GET(createMockRequest());

    expect(response1.headers.get("ETag")).toBe(response2.headers.get("ETag"));
  });

  it("returns image body as binary data", async () => {
    const imageData = Buffer.from("binary-image-content");
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      image: imageData,
      imageMime: "image/webp",
    } as never);

    const response = await GET(createMockRequest());
    const body = await response.arrayBuffer();

    expect(Buffer.from(body)).toEqual(imageData);
  });
});
