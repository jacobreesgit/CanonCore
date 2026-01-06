/**
 * Unit tests for syncAllConnections action.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import { syncAllConnections } from "@/lib/sftp-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// Mock @/lib/env
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-auth-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    BYPASS_RATE_LIMIT: "true",
  },
}));

// Mock crypto to avoid needing ENCRYPTION_KEY
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn().mockReturnValue("encrypted-credential"),
  decryptCredential: vi.fn().mockReturnValue("decrypted-credential"),
}));

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock rate-limit
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

// Mock sftp-client to avoid real connections
vi.mock("@/lib/sftp-client", () => ({
  getConnection: vi.fn().mockResolvedValue({
    list: vi.fn().mockResolvedValue([]),
  }),
  closeConnection: vi.fn().mockResolvedValue(undefined),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  removeDirectory: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock ssh2-sftp-client for testSftpConnection
vi.mock("ssh2-sftp-client", () => {
  return {
    default: class MockSftpClient {
      connect = vi.fn().mockResolvedValue(undefined);
      list = vi.fn().mockResolvedValue([]);
      end = vi.fn().mockResolvedValue(undefined);
    },
  };
});

const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

/** Helper to create a mock session */
const mockSession = (userId: string, email: string): Session => ({
  user: { id: userId, email },
  expires: new Date().toISOString(),
});

describe("syncAllConnections", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns unauthorized when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await syncAllConnections();
    expect(result.success).toBe(false);
    expect(result).toHaveProperty("error", "Unauthorized");
  });

  it("returns rate limit error when exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Too many attempts. Please try again later.",
    });
    const result = await syncAllConnections();
    expect(result.success).toBe(false);
    expect(result).toHaveProperty(
      "error",
      "Too many attempts. Please try again later."
    );
  });

  it("returns empty results when no connections exist", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findMany).mockResolvedValue([]);
    const result = await syncAllConnections();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        totalConnections: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        results: [],
      });
    }
  });
});
