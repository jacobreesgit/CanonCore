/**
 * Unit tests for Drive verification utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("drive-verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("verifyDriveSetup", () => {
    it("returns errors when credentials missing", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_E2E_REFRESH_TOKEN;
      delete process.env.GOOGLE_E2E_ROOT_FOLDER_ID;

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("GOOGLE_CLIENT_ID not set");
      expect(result.errors).toContain("GOOGLE_E2E_REFRESH_TOKEN not set");
      expect(result.errors).toContain("GOOGLE_E2E_ROOT_FOLDER_ID not set");
    });

    it("returns valid when all checks pass", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      // Mock token refresh success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      // Mock folder check success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "E2E Folder", trashed: false }),
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(true);
      expect(result.tokenValid).toBe(true);
      expect(result.folderExists).toBe(true);
      expect(result.folderTrashed).toBe(false);
      expect(result.errors).toHaveLength(0);
    });

    it("returns error when token refresh fails", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "invalid-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "Invalid token",
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.tokenValid).toBe(false);
      expect(result.errors[0]).toContain("Token refresh failed");
    });

    it("returns error when folder is trashed", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "E2E Folder", trashed: true }),
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.folderTrashed).toBe(true);
      expect(result.errors[0]).toContain("in trash");
    });

    it("returns error when folder not found", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "missing-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.folderExists).toBe(false);
      expect(result.errors[0]).toContain("not found");
    });

    it("handles network timeout", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("timed out");
    });

    it("handles folder check API errors", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("e2e");

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Folder check failed");
    });

    it("uses seed config for seed purpose", async () => {
      delete process.env.GOOGLE_SEED_REFRESH_TOKEN;
      delete process.env.GOOGLE_SEED_ROOT_FOLDER_ID;

      const { verifyDriveSetup } = await import("@/lib/drive-verification");
      const result = await verifyDriveSetup("seed");

      expect(result.errors).toContain("GOOGLE_SEED_REFRESH_TOKEN not set");
      expect(result.errors).toContain("GOOGLE_SEED_ROOT_FOLDER_ID not set");
    });
  });

  describe("assertDriveConfigured", () => {
    it("throws error with instructions when not configured", async () => {
      delete process.env.GOOGLE_E2E_REFRESH_TOKEN;

      const { assertDriveConfigured } =
        await import("@/lib/drive-verification");

      await expect(assertDriveConfigured("e2e")).rejects.toThrow(
        "Google Drive not configured"
      );
    });

    it("throws error including setup command", async () => {
      delete process.env.GOOGLE_E2E_REFRESH_TOKEN;

      const { assertDriveConfigured } =
        await import("@/lib/drive-verification");

      await expect(assertDriveConfigured("e2e")).rejects.toThrow(
        "pnpm run setup:e2e"
      );
    });

    it("does not throw when configured correctly", async () => {
      process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-token";
      process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-folder";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "access-token" }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "E2E Folder", trashed: false }),
      });

      const { assertDriveConfigured } =
        await import("@/lib/drive-verification");
      await expect(assertDriveConfigured("e2e")).resolves.toBeUndefined();
    });
  });

  describe("getDriveConfig", () => {
    it("returns e2e config", async () => {
      const { getDriveConfig } = await import("@/lib/drive-verification");
      const config = getDriveConfig("e2e");

      expect(config.name).toBe("E2E Testing");
      expect(config.tokenVar).toBe("GOOGLE_E2E_REFRESH_TOKEN");
      expect(config.setupCommand).toBe("pnpm run setup:e2e");
    });

    it("returns seed config", async () => {
      const { getDriveConfig } = await import("@/lib/drive-verification");
      const config = getDriveConfig("seed");

      expect(config.name).toBe("Database Seeding");
      expect(config.tokenVar).toBe("GOOGLE_SEED_REFRESH_TOKEN");
      expect(config.setupCommand).toBe("pnpm run setup:seed");
    });
  });
});
