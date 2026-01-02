/**
 * Integration tests for SFTP connection CRUD operations.
 * Tests with real database and encrypted credentials.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { Session } from "next-auth";
import {
  createSftpConnection,
  getSftpConnection,
  getSftpConnections,
  updateSftpConnection,
  deleteSftpConnection,
} from "@/lib/sftp-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock auth to return our test user
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock next/cache revalidatePath
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";

const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

// Unique IDs per test run
const TEST_USER_ID = `test-sftp-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `sftp-${Date.now()}@test.example.com`;

describe("SFTP Connection Integration", () => {
  beforeAll(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: TEST_USER_ID,
        email: TEST_USER_EMAIL,
        passwordHash: "hashed",
      },
    });
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    // Clean up: delete all connections for test user, then delete user
    await prisma.sftpConnection.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  });

  it("creates connection with encrypted credential in DB", async () => {
    const result = await createSftpConnection({
      name: "Test Server 1",
      host: "sftp.example.com",
      port: 22,
      username: "testuser",
      authType: "PASSWORD",
      credential: "my-secret-password",
      basePath: "/uploads",
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Failed to create connection");

    // Verify in database
    const dbConnection = await prisma.sftpConnection.findFirst({
      where: { id: result.data!.id },
    });

    expect(dbConnection).not.toBeNull();
    expect(dbConnection!.name).toBe("Test Server 1");
    // Credential should be encrypted (not the original password)
    expect(dbConnection!.encryptedCredential).not.toBe("my-secret-password");
    expect(dbConnection!.encryptedCredential.length).toBeGreaterThan(0);
  });

  it("retrieves connection without exposing credential", async () => {
    // First create a connection
    const createResult = await createSftpConnection({
      name: "Test Server 2",
      host: "sftp2.example.com",
      port: 22,
      username: "user2",
      authType: "PASSWORD",
      credential: "secret2",
    });
    if (!createResult.success) throw new Error("Failed to create connection");

    // Retrieve it
    const getResult = await getSftpConnection(createResult.data!.id);

    expect(getResult.success).toBe(true);
    if (!getResult.success) throw new Error("Failed to get connection");

    // Should have connection data but no credential exposed
    expect(getResult.data?.name).toBe("Test Server 2");
    expect(getResult.data?.host).toBe("sftp2.example.com");
    // The returned data should NOT include the credential
    expect(
      (getResult.data as Record<string, unknown>)?.credential
    ).toBeUndefined();
    expect(
      (getResult.data as Record<string, unknown>)?.encryptedCredential
    ).toBeUndefined();
  });

  it("updates connection and re-encrypts credential", async () => {
    // Create connection
    const createResult = await createSftpConnection({
      name: "Test Server 3",
      host: "sftp3.example.com",
      port: 22,
      username: "user3",
      authType: "PASSWORD",
      credential: "original-password",
    });
    if (!createResult.success) throw new Error("Failed to create connection");
    const connectionId = createResult.data!.id;

    // Get original encrypted credential
    const originalDb = await prisma.sftpConnection.findFirst({
      where: { id: connectionId },
    });
    const originalEncrypted = originalDb!.encryptedCredential;

    // Update with new credential
    const updateResult = await updateSftpConnection(connectionId, {
      credential: "new-password",
    });

    expect(updateResult.success).toBe(true);

    // Verify new encrypted credential is different
    const updatedDb = await prisma.sftpConnection.findFirst({
      where: { id: connectionId },
    });
    expect(updatedDb!.encryptedCredential).not.toBe(originalEncrypted);
    expect(updatedDb!.encryptedCredential).not.toBe("new-password");
  });

  it("deletes connection successfully", async () => {
    // Create connection
    const createResult = await createSftpConnection({
      name: "Test Server 4",
      host: "sftp4.example.com",
      port: 22,
      username: "user4",
      authType: "PASSWORD",
      credential: "password4",
    });
    if (!createResult.success) throw new Error("Failed to create connection");
    const connectionId = createResult.data!.id;

    // Delete it
    const deleteResult = await deleteSftpConnection(connectionId);
    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    const dbConnection = await prisma.sftpConnection.findFirst({
      where: { id: connectionId },
    });
    expect(dbConnection).toBeNull();
  });

  it("enforces unique name per user", async () => {
    // Create first connection
    const first = await createSftpConnection({
      name: "Duplicate Name",
      host: "sftp5.example.com",
      port: 22,
      username: "user5",
      authType: "PASSWORD",
      credential: "password5",
    });
    expect(first.success).toBe(true);

    // Try to create second with same name
    const second = await createSftpConnection({
      name: "Duplicate Name",
      host: "sftp6.example.com",
      port: 22,
      username: "user6",
      authType: "PASSWORD",
      credential: "password6",
    });

    expect(second.success).toBe(false);
    if (!second.success) {
      expect(second.error).toContain("already exists");
    }
  });

  it("lists all connections for user", async () => {
    // Create multiple connections
    await createSftpConnection({
      name: "List Test 1",
      host: "list1.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });
    await createSftpConnection({
      name: "List Test 2",
      host: "list2.example.com",
      port: 22,
      username: "user",
      authType: "PASSWORD",
      credential: "pass",
    });

    const result = await getSftpConnections();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("Failed to get connections");

    // Should have at least these two
    const names = result.data?.map((c) => c.name) ?? [];
    expect(names).toContain("List Test 1");
    expect(names).toContain("List Test 2");
  });
});
