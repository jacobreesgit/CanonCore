/**
 * Unit tests for /api/user/hero route.
 * Tests hero banner image retrieval with authentication.
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

import { GET } from "@/app/api/user/hero/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = vi.mocked(auth);
const mockFindUnique = vi.mocked(prisma.user.findUnique);

/** Create a mock NextRequest for testing */
function createMockRequest(params?: URLSearchParams): NextRequest {
  const url = new URL("http://localhost/api/user/hero");
  if (params) {
    params.forEach((value, key) => url.searchParams.set(key, value));
  }
  return new NextRequest(url);
}

describe("GET /api/user/hero", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(401);
  });

  it("returns 404 when user has no hero image", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      heroImage: null,
      heroImageMime: null,
    } as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(404);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { heroImage: true, heroImageMime: true },
    });
  });

  it("returns 404 when user has hero image but no MIME type", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      heroImage: Buffer.from("fake-image"),
      heroImageMime: null,
    } as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(404);
  });

  it("returns hero image with correct headers when exists", async () => {
    const imageData = Buffer.from("fake-hero-image-data");
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      heroImage: imageData,
      heroImageMime: "image/jpeg",
    } as never);

    const response = await GET(createMockRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(response.headers.get("ETag")).toBeTruthy();
  });

  it("returns consistent ETag for same hero image content", async () => {
    const imageData = Buffer.from("consistent-hero-data");
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      heroImage: imageData,
      heroImageMime: "image/png",
    } as never);

    const response1 = await GET(createMockRequest());
    const response2 = await GET(createMockRequest());

    expect(response1.headers.get("ETag")).toBe(response2.headers.get("ETag"));
  });

  it("returns hero image body as binary data", async () => {
    const imageData = Buffer.from("hero-binary-content");
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockFindUnique.mockResolvedValue({
      heroImage: imageData,
      heroImageMime: "image/webp",
    } as never);

    const response = await GET(createMockRequest());
    const body = await response.arrayBuffer();

    expect(Buffer.from(body)).toEqual(imageData);
  });
});
