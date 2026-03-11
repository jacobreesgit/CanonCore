/**
 * Unit tests for /api/fork/[itemId] route.
 * Tests fork GET (status/info) and POST (create fork) endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock fork-actions module
vi.mock("@/lib/fork-actions", () => ({
  forkItem: vi.fn(),
  getForkStatus: vi.fn(),
  getForkInfo: vi.fn(),
}));

import { GET, POST } from "@/app/api/fork/[itemId]/route";
import { forkItem, getForkStatus, getForkInfo } from "@/lib/fork-actions";

const mockForkItem = vi.mocked(forkItem);
const mockGetForkStatus = vi.mocked(getForkStatus);
const mockGetForkInfo = vi.mocked(getForkInfo);

/** Create a mock NextRequest for testing */
function createMockRequest(body?: object): NextRequest {
  const url = new URL("http://localhost/api/fork/item-1");
  if (body) {
    return new NextRequest(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }
  return new NextRequest(url);
}

/** Create route context with itemId */
function createContext(itemId: string) {
  return {
    params: Promise.resolve({ itemId }),
  };
}

describe("GET /api/fork/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when itemId is empty", async () => {
    const response = await GET(createMockRequest(), createContext(""));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Item ID is required");
  });

  it("returns fork status and info on success", async () => {
    mockGetForkStatus.mockResolvedValue({
      success: true,
      data: { hasForked: true, forkedItemId: "forked-1" },
    });
    mockGetForkInfo.mockResolvedValue({
      success: true,
      data: {
        source: { id: "source-1", name: "Original", ownerUsername: "creator" },
        forkCount: 5,
      },
    });

    const response = await GET(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toEqual({ hasForked: true, forkedItemId: "forked-1" });
    expect(body.info).toEqual({
      source: { id: "source-1", name: "Original", ownerUsername: "creator" },
      forkCount: 5,
    });
  });

  it("calls both getForkStatus and getForkInfo with itemId", async () => {
    mockGetForkStatus.mockResolvedValue({
      success: true,
      data: { hasForked: false, forkedItemId: null },
    });
    mockGetForkInfo.mockResolvedValue({
      success: true,
      data: { source: null, forkCount: 0 },
    });

    await GET(createMockRequest(), createContext("test-item-123"));

    expect(mockGetForkStatus).toHaveBeenCalledWith("test-item-123");
    expect(mockGetForkInfo).toHaveBeenCalledWith("test-item-123");
  });

  it("returns 400 when getForkStatus fails", async () => {
    mockGetForkStatus.mockResolvedValue({ error: "Database error" });
    mockGetForkInfo.mockResolvedValue({
      success: true,
      data: { source: null, forkCount: 0 },
    });

    const response = await GET(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Database error");
  });

  it("returns 400 when getForkInfo fails", async () => {
    mockGetForkStatus.mockResolvedValue({
      success: true,
      data: { hasForked: false, forkedItemId: null },
    });
    mockGetForkInfo.mockResolvedValue({ error: "Item not found" });

    const response = await GET(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Item not found");
  });

  it("returns status for unauthenticated user", async () => {
    mockGetForkStatus.mockResolvedValue({
      success: true,
      data: { hasForked: false, forkedItemId: null },
    });
    mockGetForkInfo.mockResolvedValue({
      success: true,
      data: { source: null, forkCount: 10 },
    });

    const response = await GET(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status.hasForked).toBe(false);
    expect(body.info.forkCount).toBe(10);
  });
});

describe("POST /api/fork/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when itemId is empty", async () => {
    const response = await POST(createMockRequest(), createContext(""));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Item ID is required");
  });

  it("returns 201 with fork data on success", async () => {
    mockForkItem.mockResolvedValue({
      success: true,
      data: { itemId: "forked-item-1", name: "My Forked Movie" },
    });

    const response = await POST(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.itemId).toBe("forked-item-1");
    expect(body.name).toBe("My Forked Movie");
  });

  it("calls forkItem with itemId and null parentId when no body", async () => {
    mockForkItem.mockResolvedValue({
      success: true,
      data: { itemId: "forked-1", name: "Test" },
    });

    await POST(createMockRequest(), createContext("source-123"));

    expect(mockForkItem).toHaveBeenCalledWith("source-123", null);
  });

  it("calls forkItem with parentId from request body", async () => {
    mockForkItem.mockResolvedValue({
      success: true,
      data: { itemId: "forked-1", name: "Test" },
    });

    await POST(
      createMockRequest({ parentId: "parent-456" }),
      createContext("source-123")
    );

    expect(mockForkItem).toHaveBeenCalledWith("source-123", "parent-456");
  });

  it("returns 401 when not authenticated", async () => {
    mockForkItem.mockResolvedValue({ error: "Not authenticated" });

    const response = await POST(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 404 when item not found", async () => {
    mockForkItem.mockResolvedValue({ error: "Item not found" });

    const response = await POST(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe("Item not found");
  });

  it("returns 400 for other errors", async () => {
    mockForkItem.mockResolvedValue({
      error: "You have already forked this item",
    });

    const response = await POST(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("You have already forked this item");
  });

  it("returns 400 when cannot fork own items", async () => {
    mockForkItem.mockResolvedValue({ error: "Cannot fork your own items" });

    const response = await POST(createMockRequest(), createContext("item-1"));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Cannot fork your own items");
  });

  it("handles invalid JSON body gracefully", async () => {
    mockForkItem.mockResolvedValue({
      success: true,
      data: { itemId: "forked-1", name: "Test" },
    });

    const request = new NextRequest(
      new URL("http://localhost/api/fork/item-1"),
      {
        method: "POST",
        body: "invalid json",
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await POST(request, createContext("item-1"));

    // Should still work, defaulting to null parentId
    expect(response.status).toBe(201);
    expect(mockForkItem).toHaveBeenCalledWith("item-1", null);
  });

  it("handles empty body gracefully", async () => {
    mockForkItem.mockResolvedValue({
      success: true,
      data: { itemId: "forked-1", name: "Test" },
    });

    const request = new NextRequest(
      new URL("http://localhost/api/fork/item-1"),
      {
        method: "POST",
      }
    );

    const response = await POST(request, createContext("item-1"));

    expect(response.status).toBe(201);
    expect(mockForkItem).toHaveBeenCalledWith("item-1", null);
  });
});
