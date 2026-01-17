/**
 * Integration tests for Google Drive batch operations.
 * Tests real batch API behavior with test Drive account.
 *
 * Requires GOOGLE_TEST_REFRESH_TOKEN for real API calls.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { batchDelete, batchMove } from "@/lib/google-drive-client";

// Skip tests if test account credentials not available
const SKIP_INTEGRATION = !process.env.GOOGLE_TEST_REFRESH_TOKEN;

// Module-level test folder ID (created if configured folder doesn't exist)
let testFolderId: string | undefined;

/**
 * Gets a fresh access token for testing.
 * Uses the test account refresh token from env vars.
 *
 * @returns Valid access token for API calls
 */
async function getTestAccessToken(): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_TEST_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

/**
 * Checks if a folder exists and is not trashed.
 *
 * @param accessToken - Valid OAuth access token
 * @param folderId - Drive folder ID to check
 * @returns True if folder exists and is not trashed
 */
async function folderExists(
  accessToken: string,
  folderId: string
): Promise<boolean> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return false;
  }

  const file = await response.json();
  return !file.trashed;
}

/**
 * Ensures a test folder exists for integration tests.
 * Uses configured folder if it exists, otherwise creates a new one.
 *
 * @param accessToken - Valid OAuth access token
 * @returns Folder ID to use for tests
 */
async function ensureTestFolder(accessToken: string): Promise<string> {
  const configuredId = process.env.GOOGLE_TEST_ROOT_FOLDER_ID;

  // Check if configured folder exists
  if (configuredId) {
    const exists = await folderExists(accessToken, configuredId);
    if (exists) {
      return configuredId;
    }
  }

  // Create a new test folder in Drive root
  const response = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `CanonCore-Integration-Tests-${Date.now()}`,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  const folder = await response.json();
  if (!folder.id) {
    throw new Error(`Failed to create test folder: ${JSON.stringify(folder)}`);
  }

  return folder.id;
}

/**
 * Creates test files in the test folder.
 *
 * @param accessToken - Valid OAuth access token
 * @param count - Number of files to create
 * @returns Array of created file IDs
 */
async function createTestFiles(
  accessToken: string,
  count: number
): Promise<string[]> {
  const fileIds: string[] = [];

  for (let i = 0; i < count; i++) {
    const response = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `batch-test-${Date.now()}-${i}`,
        parents: testFolderId ? [testFolderId] : undefined,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const file = await response.json();
    if (!file.id) {
      throw new Error(`Failed to create test file: ${JSON.stringify(file)}`);
    }
    fileIds.push(file.id);
  }

  return fileIds;
}

/**
 * Gets file metadata to verify state.
 *
 * @param accessToken - Valid OAuth access token
 * @param fileId - Drive file ID
 * @returns File metadata with id and trashed status
 */
async function getFile(
  accessToken: string,
  fileId: string
): Promise<{ id: string; trashed: boolean } | null> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,trashed`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

/**
 * Permanently deletes a file (bypasses trash).
 *
 * @param accessToken - Valid OAuth access token
 * @param fileId - Drive file ID
 */
async function permanentlyDeleteFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

describe.skipIf(SKIP_INTEGRATION)("batch operations integration", () => {
  let accessToken: string;
  let createdFileIds: string[] = [];

  beforeAll(async () => {
    const token = await getTestAccessToken();
    testFolderId = await ensureTestFolder(token);
  });

  beforeEach(async () => {
    accessToken = await getTestAccessToken();
    createdFileIds = [];
  });

  afterEach(async () => {
    // Cleanup: permanently delete test files
    for (const fileId of createdFileIds) {
      try {
        await permanentlyDeleteFile(accessToken, fileId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe("batchDelete", () => {
    it("deletes multiple files in single batch request", async () => {
      // Create test files
      const fileIds = await createTestFiles(accessToken, 3);
      createdFileIds = fileIds;

      const result = await batchDelete(accessToken, fileIds);

      expect(result.succeeded).toHaveLength(3);
      expect(result.failed).toHaveLength(0);

      // Verify files are trashed
      for (const fileId of fileIds) {
        const file = await getFile(accessToken, fileId);
        expect(file?.trashed).toBe(true);
      }
    });

    it("handles non-existent files gracefully", async () => {
      const result = await batchDelete(accessToken, [
        "nonexistent-file-id-12345",
      ]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toBeDefined();
    });

    it("handles mixed existing and non-existing files", async () => {
      const fileIds = await createTestFiles(accessToken, 2);
      createdFileIds = fileIds;

      const result = await batchDelete(accessToken, [
        ...fileIds,
        "nonexistent-file-id-12345",
      ]);

      expect(result.succeeded).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
    });

    it("returns empty result for empty array", async () => {
      const result = await batchDelete(accessToken, []);

      expect(result.succeeded).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });

  describe("batchMove", () => {
    it(
      "moves multiple files to new parent folder",
      { timeout: 30000 },
      async () => {
        // Create source folder and test files
        const [sourceFolder] = await createTestFiles(accessToken, 1);
        createdFileIds.push(sourceFolder);

        // Create files in source folder
        const fileResponse1 = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: `move-test-${Date.now()}-1`,
              parents: [sourceFolder],
              mimeType: "application/vnd.google-apps.folder",
            }),
          }
        );
        const file1 = await fileResponse1.json();
        createdFileIds.push(file1.id);

        const fileResponse2 = await fetch(
          "https://www.googleapis.com/drive/v3/files",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: `move-test-${Date.now()}-2`,
              parents: [sourceFolder],
              mimeType: "application/vnd.google-apps.folder",
            }),
          }
        );
        const file2 = await fileResponse2.json();
        createdFileIds.push(file2.id);

        // Create destination folder
        const [destFolder] = await createTestFiles(accessToken, 1);
        createdFileIds.push(destFolder);

        // Move files
        const result = await batchMove(
          accessToken,
          [file1.id, file2.id],
          destFolder,
          sourceFolder
        );

        expect(result.succeeded).toHaveLength(2);
        expect(result.failed).toHaveLength(0);

        // Verify files are now in destination folder
        const verifyResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file1.id}?fields=parents`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
        const verifyFile = await verifyResponse.json();
        expect(verifyFile.parents).toContain(destFolder);
      }
    );
  });
});
