/**
 * Integration tests for E2E automatic setup.
 * Tests actual Drive operations with real credentials.
 *
 * IMPORTANT: These tests modify real Google Drive content.
 * Only run with a dedicated E2E test account.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

// Skip if E2E credentials not configured
const E2E_CONFIGURED =
  process.env.GOOGLE_E2E_REFRESH_TOKEN &&
  process.env.GOOGLE_E2E_ROOT_FOLDER_ID &&
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET;

describe.skipIf(!E2E_CONFIGURED)("e2e-setup integration", () => {
  beforeAll(() => {
    if (!E2E_CONFIGURED) {
      console.log(
        "Skipping E2E setup integration tests - credentials not configured"
      );
    }
  });

  describe("restoreRootFolderIfTrashed", () => {
    it("returns true when root folder exists and is not trashed", async () => {
      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(true);
    });
  });

  describe("ensureTestFolderExists", () => {
    it("returns folder ID (creates if needed)", async () => {
      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      const folderId = await ensureTestFolderExists();
      expect(folderId).toBeTruthy();
      expect(typeof folderId).toBe("string");
    });
  });

  describe("ensureVideoFileExists", () => {
    it("returns video info if exists", async () => {
      const { ensureTestFolderExists, ensureVideoFileExists } =
        await import("@/lib/e2e-setup");
      const folderId = await ensureTestFolderExists();
      const result = await ensureVideoFileExists(folderId);

      // Either exists or returns reason why not
      if (result.exists) {
        expect(result.fileId).toBeTruthy();
        expect(result.fileName).toBeTruthy();
      } else {
        expect(result.reason).toBeTruthy();
      }
    });
  });

  describe("ensureE2EUserExists", () => {
    it("returns user ID (creates if needed)", async () => {
      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      const userId = await ensureE2EUserExists();
      expect(userId).toBeTruthy();
      expect(typeof userId).toBe("string");
    });
  });

  describe("ensureDriveConnectionExists", () => {
    it("returns connection ID (creates if needed)", async () => {
      const { ensureE2EUserExists, ensureDriveConnectionExists } =
        await import("@/lib/e2e-setup");
      const userId = await ensureE2EUserExists();
      const connectionId = await ensureDriveConnectionExists(userId);
      expect(connectionId).toBeTruthy();
      expect(typeof connectionId).toBe("string");
    });
  });

  describe("runAutomaticSetup", () => {
    it("runs full setup and returns success or clear error", async () => {
      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();

      if (result.success) {
        expect(result.userId).toBeTruthy();
        expect(result.testFolderId).toBeTruthy();
      } else {
        // Should have clear error message
        expect(result.error).toBeTruthy();
        console.log(
          "Setup failed (expected if video not uploaded):",
          result.error
        );
      }
    });
  });
});
