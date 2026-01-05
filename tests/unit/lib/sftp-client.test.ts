/**
 * Unit tests for SFTP client service.
 * Tests checkFileExists with mocked ssh2-sftp-client.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SftpConnection } from "@prisma/client";

// Mock @/lib/crypto
vi.mock("@/lib/crypto", () => ({
  decryptCredential: vi.fn().mockReturnValue("decrypted-password"),
}));

// Mock @/lib/sftp-utils - pass through the promise
vi.mock("@/lib/sftp-utils", () => ({
  withTimeout: vi.fn((promise: Promise<unknown>) => promise),
}));

// Create mock functions for the SFTP client
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockEnd = vi.fn().mockResolvedValue(undefined);
const mockExists = vi.fn();

// Mock ssh2-sftp-client
vi.mock("ssh2-sftp-client", () => {
  return {
    default: class MockSftpClient {
      connect = mockConnect;
      end = mockEnd;
      exists = mockExists;
    },
  };
});

/** Helper to create a mock SFTP connection */
const mockConnection = (
  overrides: Partial<SftpConnection> = {}
): SftpConnection => ({
  id: "conn-1",
  userId: "user-1",
  name: "Test Server",
  host: "sftp.example.com",
  port: 22,
  username: "testuser",
  authType: "PASSWORD",
  encryptedCredential: "encrypted-credential",
  basePath: "/uploads",
  webdavUrl: null,
  webdavUsername: null,
  encryptedWebdavPassword: null,
  isActive: true,
  lastConnectedAt: null,
  lastSyncAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("checkFileExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache to get fresh connection pool
    vi.resetModules();
  });

  it("returns true when file exists", async () => {
    // exists() returns '-' for regular files
    mockExists.mockResolvedValue("-");

    // Import after mocks are set up
    const { checkFileExists } = await import("@/lib/sftp-client");

    const result = await checkFileExists(
      mockConnection(),
      "/uploads/test-file.txt"
    );

    expect(result).toBe(true);
    expect(mockExists).toHaveBeenCalledWith("/uploads/test-file.txt");
  });

  it("returns false when file is missing", async () => {
    // exists() returns false when file does not exist
    mockExists.mockResolvedValue(false);

    // Import after mocks are set up
    const { checkFileExists } = await import("@/lib/sftp-client");

    const result = await checkFileExists(
      mockConnection({ id: "conn-2" }),
      "/uploads/nonexistent.txt"
    );

    expect(result).toBe(false);
    expect(mockExists).toHaveBeenCalledWith("/uploads/nonexistent.txt");
  });

  it("returns true when path is a directory", async () => {
    // exists() returns 'd' for directories
    mockExists.mockResolvedValue("d");

    const { checkFileExists } = await import("@/lib/sftp-client");

    const result = await checkFileExists(
      mockConnection({ id: "conn-3" }),
      "/uploads/some-folder"
    );

    expect(result).toBe(true);
    expect(mockExists).toHaveBeenCalledWith("/uploads/some-folder");
  });

  it("returns true when path is a symlink", async () => {
    // exists() returns 'l' for symbolic links
    mockExists.mockResolvedValue("l");

    const { checkFileExists } = await import("@/lib/sftp-client");

    const result = await checkFileExists(
      mockConnection({ id: "conn-4" }),
      "/uploads/symlink"
    );

    expect(result).toBe(true);
    expect(mockExists).toHaveBeenCalledWith("/uploads/symlink");
  });
});
