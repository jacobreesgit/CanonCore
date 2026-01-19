/**
 * Unit tests for /api/username/check route.
 * Tests username availability checking with validation and rate limiting.
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
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/validations", () => ({
  validateUsername: vi.fn(),
  RESERVED_USERNAMES: new Set(["admin", "root", "system"]),
}));

import { GET } from "@/app/api/username/check/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateUsername } from "@/lib/validations";

const mockAuth = vi.mocked(auth);
const mockFindFirst = vi.mocked(prisma.user.findFirst);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockValidateUsername = vi.mocked(validateUsername);

/** Create a mock NextRequest for testing */
function createMockRequest(username?: string): NextRequest {
  const url = new URL("http://localhost/api/username/check");
  if (username !== undefined) {
    url.searchParams.set("username", username);
  }
  return new NextRequest(url);
}

describe("GET /api/username/check", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(null as never);
    mockCheckRateLimit.mockResolvedValue(null);
    mockValidateUsername.mockReturnValue({ success: true });
  });

  describe("rate limiting", () => {
    it("returns 429 when rate limited", async () => {
      mockCheckRateLimit.mockResolvedValue({ error: "Too many requests" });

      const response = await GET(createMockRequest("testuser"));

      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.available).toBe(false);
      expect(body.error).toBe("Too many requests");
    });

    it("calls rate limit check with usernameCheck type", async () => {
      await GET(createMockRequest("testuser"));

      expect(mockCheckRateLimit).toHaveBeenCalledWith("usernameCheck");
    });
  });

  describe("validation", () => {
    it("returns 400 when username is missing", async () => {
      const response = await GET(createMockRequest());

      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.available).toBe(false);
      expect(body.error).toBe("Username is required");
    });

    it("returns unavailable for invalid format", async () => {
      mockValidateUsername.mockReturnValue({
        success: false,
        error: "Username must be 3-20 characters",
      });

      const response = await GET(createMockRequest("ab"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.available).toBe(false);
      expect(body.error).toBe("Username must be 3-20 characters");
    });

    it("returns unavailable for reserved username", async () => {
      mockValidateUsername.mockReturnValue({ success: true });

      const response = await GET(createMockRequest("admin"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.available).toBe(false);
      expect(body.error).toBe("This username is reserved");
    });

    it("normalizes username to lowercase", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue(null);

      await GET(createMockRequest("TestUser"));

      expect(mockValidateUsername).toHaveBeenCalledWith("testuser");
    });

    it("trims whitespace from username", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue(null);

      await GET(createMockRequest("  testuser  "));

      expect(mockValidateUsername).toHaveBeenCalledWith("testuser");
    });
  });

  describe("availability check", () => {
    it("returns available true when username does not exist", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue(null);

      const response = await GET(createMockRequest("newuser"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.available).toBe(true);
      expect(body.error).toBeUndefined();
    });

    it("returns available false when username exists", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue({ id: "other-user" } as never);

      const response = await GET(createMockRequest("takenuser"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.available).toBe(false);
    });

    it("performs case-insensitive database lookup", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue(null);

      await GET(createMockRequest("TestUser"));

      expect(mockFindFirst).toHaveBeenCalledWith({
        where: {
          username: {
            equals: "testuser",
            mode: "insensitive",
          },
        },
        select: { id: true },
      });
    });
  });

  describe("authenticated user handling", () => {
    it("returns available true when user owns the username", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue({ id: "user-1" } as never);

      const response = await GET(createMockRequest("myusername"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.available).toBe(true);
    });

    it("returns available false when another user owns the username", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockResolvedValue({ id: "other-user" } as never);

      const response = await GET(createMockRequest("otheruser"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.available).toBe(false);
    });
  });

  describe("error handling", () => {
    it("returns 500 on database error", async () => {
      mockValidateUsername.mockReturnValue({ success: true });
      mockFindFirst.mockRejectedValue(new Error("Database connection failed"));

      const response = await GET(createMockRequest("testuser"));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.available).toBe(false);
      expect(body.error).toBe("Failed to check username");
    });
  });
});
