/**
 * Unit tests for /api/auth/callback/google-drive route.
 * Tests OAuth callback handling with CSRF protection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before imports
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    googleDriveConnection: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn((value: string) => `encrypted:${value}`),
}));

vi.mock("@/lib/google-drive-client", () => ({
  exchangeCodeForTokens: vi.fn(),
  getUserEmail: vi.fn(),
  createRootFolder: vi.fn(),
  verifyOAuthState: vi.fn(),
}));

vi.mock("googleapis", () => {
  class MockOAuth2 {
    setCredentials = vi.fn();
  }
  return {
    google: {
      auth: {
        OAuth2: MockOAuth2,
      },
      drive: vi.fn(() => ({})),
    },
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { GET } from "@/app/api/auth/callback/google-drive/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  exchangeCodeForTokens,
  getUserEmail,
  createRootFolder,
  verifyOAuthState,
} from "@/lib/google-drive-client";

const mockAuth = vi.mocked(auth);
const mockUpsert = vi.mocked(prisma.googleDriveConnection.upsert);
const mockUserFindUnique = vi.mocked(prisma.user.findUnique);
const mockExchangeCode = vi.mocked(exchangeCodeForTokens);
const mockGetUserEmail = vi.mocked(getUserEmail);
const mockCreateRootFolder = vi.mocked(createRootFolder);
const mockVerifyState = vi.mocked(verifyOAuthState);

function createRequest(
  params: Record<string, string> = {},
  baseUrl = "http://localhost"
) {
  const searchParams = new URLSearchParams(params);
  return new NextRequest(
    `${baseUrl}/api/auth/callback/google-drive?${searchParams.toString()}`
  );
}

describe("GET /api/auth/callback/google-drive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user has a username
    mockUserFindUnique.mockResolvedValue({ username: "testuser" } as never);
  });

  it("redirects to sign-in when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET(createRequest({ code: "test-code" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/sign-in?error=unauthorized"
    );
  });

  it("redirects with error when OAuth error parameter present", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await GET(createRequest({ error: "access_denied" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=access_denied"
    );
  });

  it("redirects with no_code error when code is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await GET(createRequest({ state: "valid-state" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=no_code"
    );
  });

  it("redirects with no_state error when state is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await GET(createRequest({ code: "test-code" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=no_state"
    );
  });

  it("redirects with invalid_state error when state verification fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue(null);

    const response = await GET(
      createRequest({ code: "test-code", state: "invalid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=invalid_state"
    );
    expect(mockVerifyState).toHaveBeenCalledWith("invalid-state");
  });

  it("redirects with state_mismatch error when user ID doesn't match", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue({
      userId: "different-user",
      timestamp: Date.now(),
    });

    const response = await GET(
      createRequest({ code: "test-code", state: "valid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=state_mismatch"
    );
  });

  it("creates connection and redirects on success", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue({
      userId: "user-1",
      timestamp: Date.now(),
    });
    mockExchangeCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
    });
    mockGetUserEmail.mockResolvedValue("user@example.com");
    mockCreateRootFolder.mockResolvedValue({
      id: "root-folder-id",
      wasExisting: false,
    });
    mockUpsert.mockResolvedValue({} as never);

    const response = await GET(
      createRequest({ code: "test-code", state: "valid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?drive=connected"
    );
    expect(mockExchangeCode).toHaveBeenCalledWith("test-code");
    expect(mockGetUserEmail).toHaveBeenCalledWith("access-token");
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      create: expect.objectContaining({
        userId: "user-1",
        email: "user@example.com",
        rootFolderId: "root-folder-id",
        isActive: true,
        needsReauth: false,
      }),
      update: expect.objectContaining({
        email: "user@example.com",
        rootFolderId: "root-folder-id",
        needsReauth: false,
        lastError: null,
      }),
    });
  });

  it("redirects with error when token exchange fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue({
      userId: "user-1",
      timestamp: Date.now(),
    });
    mockExchangeCode.mockRejectedValue(new Error("Token exchange failed"));

    const response = await GET(
      createRequest({ code: "test-code", state: "valid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=Connection%20failed.%20Please%20try%20again."
    );
  });

  it("redirects with generic error when user email fetch fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue({
      userId: "user-1",
      timestamp: Date.now(),
    });
    mockExchangeCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
    });
    mockGetUserEmail.mockRejectedValue(new Error("Failed to get email"));

    const response = await GET(
      createRequest({ code: "test-code", state: "valid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=Connection%20failed.%20Please%20try%20again."
    );
  });

  it("redirects with generic error when root folder creation fails", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue({
      userId: "user-1",
      timestamp: Date.now(),
    });
    mockExchangeCode.mockResolvedValue({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600,
    });
    mockGetUserEmail.mockResolvedValue("user@example.com");
    mockCreateRootFolder.mockRejectedValue(
      new Error("Failed to create folder")
    );

    const response = await GET(
      createRequest({ code: "test-code", state: "valid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=Connection%20failed.%20Please%20try%20again."
    );
  });

  it("redirects with generic error when non-Error is thrown", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockVerifyState.mockReturnValue({
      userId: "user-1",
      timestamp: Date.now(),
    });
    mockExchangeCode.mockRejectedValue("non-error-value");

    const response = await GET(
      createRequest({ code: "test-code", state: "valid-state" })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "/u/testuser?error=Connection%20failed.%20Please%20try%20again."
    );
  });

  it("redirects to / when user has no username", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } } as never);
    mockUserFindUnique.mockResolvedValue({ username: null } as never);

    const response = await GET(createRequest({ error: "access_denied" }));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/?error=access_denied");
  });
});
