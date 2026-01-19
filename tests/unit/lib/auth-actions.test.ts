import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUp, forgotPassword, resetPassword } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

// Mock @/lib/env to avoid validation errors in unit tests
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

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Set BYPASS_RATE_LIMIT for tests (for rate-limit.ts which reads process.env directly)
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

/**
 * Creates a mock user object with all required fields.
 */
function createMockUser(
  overrides: Partial<{
    id: string;
    email: string;
    passwordHash: string;
    emailVerified: Date | null;
    name: string | null;
    username: string | null;
    isPublic: boolean;
    image: Uint8Array<ArrayBuffer> | null;
    imageMime: string | null;
    heroImage: Uint8Array<ArrayBuffer> | null;
    heroImageMime: string | null;
    defaultViewMode: string | null;
    defaultSortBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
) {
  return {
    id: "1",
    email: "test@example.com",
    passwordHash: "hashed",
    emailVerified: null,
    name: null,
    username: null,
    isPublic: false,
    image: null,
    imageMime: null,
    heroImage: null,
    heroImageMime: null,
    defaultViewMode: null,
    defaultSortBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates user with hashed password when email is new", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(createMockUser());

    const result = await signUp("test@example.com", "Password123!");

    expect(result.success).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "test@example.com" },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "test@example.com",
        passwordHash: expect.any(String),
      }),
    });
  });

  it("returns error when email already exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({ email: "exists@example.com" })
    );

    const result = await signUp("exists@example.com", "Password123!");

    expect(result.error).toBe("An account with this email already exists");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("hashes password before storing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(createMockUser());

    await signUp("test@example.com", "Password1");

    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect(createCall.data.passwordHash).not.toBe("Password1");
    expect(createCall.data.passwordHash.length).toBeGreaterThan(20);
  });

  it("returns validation error for weak password", async () => {
    const result = await signUp("test@example.com", "weak");

    expect(result.error).toBeDefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns validation error for invalid email", async () => {
    const result = await signUp("notanemail", "Password123!");

    expect(result.error).toBeDefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("forgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns success even when user does not exist (prevents enumeration)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await forgotPassword("nonexistent@example.com");

    expect(result.success).toBe(true);
    expect(prisma.passwordReset.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("creates reset token and sends email when user exists", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({ id: "user-1" })
    );
    vi.mocked(prisma.passwordReset.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.passwordReset.create).mockResolvedValue({
      id: "reset-1",
      token: "token",
      userId: "user-1",
      expires: new Date(),
      createdAt: new Date(),
    });

    const result = await forgotPassword("test@example.com");

    expect(result.success).toBe(true);
    expect(prisma.passwordReset.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(prisma.passwordReset.create).toHaveBeenCalled();
    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      "test@example.com",
      expect.any(String)
    );
  });

  it("returns validation error for invalid email", async () => {
    const result = await forgotPassword("notanemail");

    expect(result.error).toBeDefined();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for invalid token", async () => {
    vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue(null);

    const result = await resetPassword("invalid-token", "NewPassword123!");

    expect(result.error).toBe("Invalid or expired reset link");
  });

  it("returns error for expired token", async () => {
    vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
      id: "reset-1",
      token: "valid-token",
      userId: "user-1",
      expires: new Date(Date.now() - 1000), // Expired
      createdAt: new Date(),
      user: {
        id: "user-1",
        email: "test@example.com",
        passwordHash: "hashed",
        emailVerified: null,
        name: null,
        image: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    } as never);
    vi.mocked(prisma.passwordReset.delete).mockResolvedValue({
      id: "reset-1",
      token: "valid-token",
      userId: "user-1",
      expires: new Date(),
      createdAt: new Date(),
    });

    const result = await resetPassword("valid-token", "NewPassword123!");

    expect(result.error).toBe("Reset link has expired");
    expect(prisma.passwordReset.delete).toHaveBeenCalled();
  });

  it("updates password and deletes token on success", async () => {
    vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
      id: "reset-1",
      token: "valid-token",
      userId: "user-1",
      expires: new Date(Date.now() + 60000), // Valid for 1 minute
      createdAt: new Date(),
      user: createMockUser({ id: "user-1" }),
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue(
      createMockUser({ id: "user-1", passwordHash: "new-hash" })
    );
    vi.mocked(prisma.passwordReset.delete).mockResolvedValue({
      id: "reset-1",
      token: "valid-token",
      userId: "user-1",
      expires: new Date(),
      createdAt: new Date(),
    });

    const result = await resetPassword("valid-token", "NewPassword123!");

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: expect.any(String) },
    });
    expect(prisma.passwordReset.delete).toHaveBeenCalledWith({
      where: { id: "reset-1" },
    });
  });

  it("returns validation error for weak password", async () => {
    const result = await resetPassword("valid-token", "weak");

    expect(result.error).toBeDefined();
    expect(prisma.passwordReset.findUnique).not.toHaveBeenCalled();
  });
});
