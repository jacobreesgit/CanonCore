/**
 * Unit tests for SFTP connection actions.
 * Tests CRUD operations with mocked Prisma and auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import {
  getSftpConnections,
  getSftpConnection,
  createSftpConnection,
  updateSftpConnection,
  deleteSftpConnection,
  testSftpConnection,
} from "@/lib/sftp-actions";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

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

// Mock sftp-client to avoid real connections
vi.mock("@/lib/sftp-client", () => ({
  getConnection: vi.fn().mockResolvedValue({}),
  closeConnection: vi.fn().mockResolvedValue(undefined),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  removeDirectory: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock ssh2-sftp-client for testSftpConnection
vi.mock("ssh2-sftp-client", () => {
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const mockList = vi.fn().mockResolvedValue([]);
  const mockEnd = vi.fn().mockResolvedValue(undefined);

  return {
    default: class MockSftpClient {
      connect = mockConnect;
      list = mockList;
      end = mockEnd;

      static _mocks = { connect: mockConnect, list: mockList, end: mockEnd };
    },
  };
});

// Get mock references for test assertions
const getMockSftpClient = async () => {
  const Client = (await import("ssh2-sftp-client")).default;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (Client as any)._mocks;
};

const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

/** Helper to create a mock session */
const mockSession = (userId: string, email: string): Session => ({
  user: { id: userId, email },
  expires: new Date().toISOString(),
});

/** Helper to create a mock SFTP connection */
const mockConnection = (
  overrides: Partial<{
    id: string;
    userId: string;
    name: string;
    host: string;
    port: number;
    username: string;
    authType: "PASSWORD" | "PRIVATE_KEY";
    encryptedCredential: string;
    basePath: string;
    webdavUrl: string | null;
    webdavUsername: string | null;
    encryptedWebdavPassword: string | null;
    isActive: boolean;
    lastConnectedAt: Date | null;
    lastSyncAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) => ({
  id: "conn-1",
  userId: "user-1",
  name: "Test Server",
  host: "sftp.example.com",
  port: 22,
  username: "testuser",
  authType: "PASSWORD" as const,
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

describe("getSftpConnections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getSftpConnections();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Failed to load connections");
    }
  });

  it("returns connections for authenticated user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findMany).mockResolvedValue([
      mockConnection({ id: "conn-1", name: "Server 1" }),
      mockConnection({ id: "conn-2", name: "Server 2" }),
    ]);

    const result = await getSftpConnections();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
    expect(prisma.sftpConnection.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { createdAt: "desc" },
      select: expect.objectContaining({
        id: true,
        name: true,
        host: true,
      }),
    });
  });
});

describe("getSftpConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getSftpConnection("conn-1");

    expect(result.success).toBe(false);
  });

  it("returns error when connection not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(null);

    const result = await getSftpConnection("nonexistent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Connection not found");
    }
  });

  it("returns connection for authenticated user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection()
    );

    const result = await getSftpConnection("conn-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.name).toBe("Test Server");
    }
  });
});

describe("createSftpConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await createSftpConnection({
      name: "New Server",
      host: "sftp.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "password",
    });

    expect(result.success).toBe(false);
  });

  it("returns error for duplicate name", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection({ name: "Existing Server" })
    );

    const result = await createSftpConnection({
      name: "Existing Server",
      host: "sftp.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("already exists");
    }
  });

  it("creates connection with encrypted credential", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.sftpConnection.create).mockResolvedValue(
      mockConnection({ id: "new-conn" })
    );

    const result = await createSftpConnection({
      name: "New Server",
      host: "sftp.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "password",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.id).toBe("new-conn");
    }
    expect(prisma.sftpConnection.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        name: "New Server",
        encryptedCredential: expect.any(String),
      }),
    });
  });
});

describe("updateSftpConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateSftpConnection("conn-1", { name: "Updated" });

    expect(result.success).toBe(false);
  });

  it("returns error when connection not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(null);

    const result = await updateSftpConnection("nonexistent", {
      name: "Updated",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Connection not found");
    }
  });

  it("updates connection successfully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    // First call: verify ownership, returns existing connection
    // Second call: check duplicate name, returns null (no duplicate)
    vi.mocked(prisma.sftpConnection.findFirst)
      .mockResolvedValueOnce(mockConnection())
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.sftpConnection.update).mockResolvedValue(
      mockConnection({ name: "Updated Server" })
    );

    const result = await updateSftpConnection("conn-1", {
      name: "Updated Server",
    });

    expect(result.success).toBe(true);
    expect(prisma.sftpConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { name: "Updated Server" },
    });
  });
});

describe("deleteSftpConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await deleteSftpConnection("conn-1");

    expect(result.success).toBe(false);
  });

  it("returns error when connection not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(null);

    const result = await deleteSftpConnection("nonexistent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Connection not found");
    }
  });

  it("deletes connection and closes pooled client", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection()
    );
    vi.mocked(prisma.sftpConnection.delete).mockResolvedValue(mockConnection());

    const result = await deleteSftpConnection("conn-1");

    expect(result.success).toBe(true);
    expect(prisma.sftpConnection.delete).toHaveBeenCalledWith({
      where: { id: "conn-1" },
    });
  });
});

describe("testSftpConnection", () => {
  let sftpMocks: {
    connect: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    sftpMocks = await getMockSftpClient();
    sftpMocks.connect.mockResolvedValue(undefined);
    sftpMocks.list.mockResolvedValue([]);
    sftpMocks.end.mockResolvedValue(undefined);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await testSftpConnection("conn-1");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Connection failed. Please check your credentials."
      );
    }
  });

  it("returns error when connection not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(null);

    const result = await testSftpConnection("nonexistent");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Connection not found");
    }
  });

  it("returns latency on successful connection", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection()
    );
    vi.mocked(prisma.sftpConnection.update).mockResolvedValue(mockConnection());

    const result = await testSftpConnection("conn-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.latencyMs).toBeGreaterThanOrEqual(0);
    }
    expect(sftpMocks.connect).toHaveBeenCalled();
    expect(sftpMocks.list).toHaveBeenCalledWith("/uploads");
    expect(sftpMocks.end).toHaveBeenCalled();
  });

  it("updates lastConnectedAt and clears lastError on success", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection({ lastError: "Previous error" })
    );
    vi.mocked(prisma.sftpConnection.update).mockResolvedValue(mockConnection());

    await testSftpConnection("conn-1");

    expect(prisma.sftpConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { lastConnectedAt: expect.any(Date), lastError: null },
    });
  });

  it("updates lastError on connection failure", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.sftpConnection.findFirst).mockResolvedValue(
      mockConnection()
    );
    sftpMocks.connect.mockRejectedValue(new Error("Connection refused"));
    vi.mocked(prisma.sftpConnection.update).mockResolvedValue(mockConnection());

    const result = await testSftpConnection("conn-1");

    expect(result.success).toBe(false);
    expect(prisma.sftpConnection.update).toHaveBeenCalledWith({
      where: { id: "conn-1" },
      data: { lastError: "Connection refused" },
    });
  });
});
