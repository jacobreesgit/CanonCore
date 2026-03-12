/**
 * Unit tests for rate limiting utilities.
 * Tests rate limiter configuration and checkRateLimit function behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Unmock the rate-limit module first (it's mocked in setup.ts)
vi.unmock("@/lib/rate-limit");

// Use vi.hoisted to ensure mockLimit is available before mock factory runs
const mockLimit = vi.hoisted(() => vi.fn());

// Mock dependencies before imports
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
  },
}));

// Mock Upstash Redis
vi.mock("@upstash/redis", () => ({
  Redis: class MockRedis {},
}));

// Mock the Ratelimit class with hoisted mockLimit
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class MockRatelimit {
    static slidingWindow() {
      return {};
    }
    limit = mockLimit;
  },
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockImplementation(async () => ({
    get: () => "127.0.0.1",
  })),
}));

// Import after mocks are set up
import { rateLimiters, checkRateLimit } from "@/lib/rate-limit";

describe("rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit succeeds (not exceeded)
    mockLimit.mockResolvedValue({ success: true });
    // Default: rate limit not bypassed
    vi.stubEnv("BYPASS_RATE_LIMIT", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("rateLimiters", () => {
    it("should export all rate limiter configurations", () => {
      // Auth limiters
      expect(rateLimiters.signIn).toBeDefined();
      expect(rateLimiters.signUp).toBeDefined();
      expect(rateLimiters.forgotPassword).toBeDefined();
      expect(rateLimiters.passwordChange).toBeDefined();

      // Item limiters
      expect(rateLimiters.itemCreate).toBeDefined();
      expect(rateLimiters.itemPin).toBeDefined();
      expect(rateLimiters.itemUpdate).toBeDefined();
      expect(rateLimiters.itemDelete).toBeDefined();
      expect(rateLimiters.itemSearch).toBeDefined();

      // TMDB limiters
      expect(rateLimiters.tmdbSearch).toBeDefined();
      expect(rateLimiters.tmdbPreview).toBeDefined();
      expect(rateLimiters.tmdbBackdrop).toBeDefined();
      expect(rateLimiters.tmdbImages).toBeDefined();

      // Public profile limiters
      expect(rateLimiters.usernameCheck).toBeDefined();
      expect(rateLimiters.fork).toBeDefined();
      expect(rateLimiters.publicProfile).toBeDefined();
      expect(rateLimiters.explore).toBeDefined();
    });

    it("should have limit method on each rate limiter", () => {
      expect(typeof rateLimiters.signIn.limit).toBe("function");
      expect(typeof rateLimiters.signUp.limit).toBe("function");
      expect(typeof rateLimiters.itemCreate.limit).toBe("function");
    });
  });

  describe("checkRateLimit", () => {
    it("should bypass rate limit when BYPASS_RATE_LIMIT is true", async () => {
      vi.stubEnv("BYPASS_RATE_LIMIT", "true");
      mockLimit.mockResolvedValue({ success: false }); // Should be bypassed

      const result = await checkRateLimit("signIn");

      expect(result).toBeNull();
      // limit should not be called when bypassed
      expect(mockLimit).not.toHaveBeenCalled();
    });

    it("should return null when rate limit is not exceeded", async () => {
      mockLimit.mockResolvedValue({ success: true });

      const result = await checkRateLimit("signIn");

      expect(result).toBeNull();
      expect(mockLimit).toHaveBeenCalled();
    });

    it("should return error when rate limit is exceeded", async () => {
      mockLimit.mockResolvedValue({ success: false });

      const result = await checkRateLimit("signIn");

      expect(result).toEqual({
        error: "Too many attempts. Please try again later.",
      });
    });

    it("should work with signUp rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("signUp");
      expect(result).toBeNull();
    });

    it("should work with forgotPassword rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("forgotPassword");
      expect(result).toBeNull();
    });

    it("should work with passwordChange rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("passwordChange");
      expect(result).toBeNull();
    });

    it("should work with itemCreate rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("itemCreate");
      expect(result).toBeNull();
    });

    it("should work with itemPin rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("itemPin");
      expect(result).toBeNull();
    });

    it("should work with itemUpdate rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("itemUpdate");
      expect(result).toBeNull();
    });

    it("should work with itemDelete rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("itemDelete");
      expect(result).toBeNull();
    });

    it("should work with itemSearch rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("itemSearch");
      expect(result).toBeNull();
    });

    it("should work with tmdbSearch rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("tmdbSearch");
      expect(result).toBeNull();
    });

    it("should work with tmdbPreview rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("tmdbPreview");
      expect(result).toBeNull();
    });

    it("should work with tmdbBackdrop rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("tmdbBackdrop");
      expect(result).toBeNull();
    });

    it("should work with tmdbImages rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("tmdbImages");
      expect(result).toBeNull();
    });

    it("should work with usernameCheck rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("usernameCheck");
      expect(result).toBeNull();
    });

    it("should work with fork rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("fork");
      expect(result).toBeNull();
    });

    it("should work with publicProfile rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("publicProfile");
      expect(result).toBeNull();
    });

    it("should work with explore rate limiter", async () => {
      mockLimit.mockResolvedValue({ success: true });
      const result = await checkRateLimit("explore");
      expect(result).toBeNull();
    });

    it("should return error for any limiter when exceeded", async () => {
      mockLimit.mockResolvedValue({ success: false });

      const result = await checkRateLimit("itemSearch");
      expect(result).toEqual({
        error: "Too many attempts. Please try again later.",
      });
    });
  });
});
