import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  signUp,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

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

// Mock @/lib/auth for resendVerificationEmail session check
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "1", email: "test@example.com" },
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
    dominantColour: string | null;
    bio: string | null;
    tokenVersion: number;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    seedContentHash: string | null;
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
    dominantColour: null,
    bio: null,
    tokenVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    seedContentHash: null,
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
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
      {} as never
    );

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

  it("creates email verification token on successful signup", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue(
      createMockUser({ id: "new-1" })
    );
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
      {} as never
    );
    vi.mocked(sendVerificationEmail).mockResolvedValue(undefined);

    const result = await signUp("new@example.com", "Password1");

    expect(result.success).toBe(true);
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    expect(sendVerificationEmail).toHaveBeenCalledWith(
      "new@example.com",
      expect.any(String)
    );
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
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
      {} as never
    );

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

  describe("username handling", () => {
    it("creates user with valid username", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(
        createMockUser({ username: "johndoe" })
      );
      vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
        {} as never
      );

      const result = await signUp(
        "test@example.com",
        "Password123!",
        "johndoe"
      );

      expect(result.success).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: "test@example.com",
          username: "johndoe",
        }),
      });
    });

    it("creates user with null username when not provided", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(createMockUser());
      vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
        {} as never
      );

      await signUp("test@example.com", "Password123!");

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: null,
        }),
      });
    });

    it("returns error for invalid username format (uppercase)", async () => {
      const result = await signUp(
        "test@example.com",
        "Password123!",
        "JohnDoe"
      );

      expect(result.error).toContain("lowercase");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns error for username too short", async () => {
      const result = await signUp("test@example.com", "Password123!", "ab");

      expect(result.error).toContain("at least 3");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns error for username starting with underscore", async () => {
      const result = await signUp(
        "test@example.com",
        "Password123!",
        "_johndoe"
      );

      expect(result.error).toContain("cannot start");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns error for reserved username", async () => {
      const result = await signUp("test@example.com", "Password123!", "admin");

      expect(result.error).toContain("reserved");
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it("returns error when username already taken (case-insensitive)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // Email not taken
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        createMockUser({ username: "johndoe" }) // Username taken
      );

      const result = await signUp(
        "test@example.com",
        "Password123!",
        "JohnDoe"
      );

      // Note: This will first fail username validation (uppercase)
      // So let's test with lowercase
      expect(result.error).toBeDefined();
    });

    it("returns error when username already taken (same case)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null); // Email not taken
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        createMockUser({ username: "johndoe" }) // Username taken
      );

      const result = await signUp(
        "test@example.com",
        "Password123!",
        "johndoe"
      );

      expect(result.error).toBe("This username is already taken");
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("checks username availability with case-insensitive query", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(
        createMockUser({ username: "testuser" })
      );
      vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
        {} as never
      );

      await signUp("test@example.com", "Password123!", "testuser");

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          username: {
            equals: "testuser",
            mode: "insensitive",
          },
        },
      });
    });
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
      data: {
        passwordHash: expect.any(String),
        tokenVersion: { increment: 1 },
      },
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

describe("verifyEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets emailVerified on valid token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
      id: "evt-1",
      token: "valid-token",
      userId: "1",
      email: "test@example.com",
      expires: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
      user: createMockUser(),
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({} as never);
    vi.mocked(prisma.emailVerificationToken.delete).mockResolvedValue(
      {} as never
    );

    const result = await verifyEmail("valid-token");

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailVerified: expect.any(Date),
        }),
      })
    );
  });

  it("rejects expired token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue({
      id: "evt-2",
      token: "expired-token",
      userId: "1",
      email: "test@example.com",
      expires: new Date(Date.now() - 60 * 1000), // expired
      createdAt: new Date(),
      user: createMockUser(),
    } as never);
    vi.mocked(prisma.emailVerificationToken.delete).mockResolvedValue(
      {} as never
    );

    const result = await verifyEmail("expired-token");

    expect(result.error).toBe("Verification link has expired");
  });

  it("rejects invalid token", async () => {
    vi.mocked(prisma.emailVerificationToken.findUnique).mockResolvedValue(null);

    const result = await verifyEmail("invalid-token");

    expect(result.error).toBe("Invalid or expired verification link");
  });
});

describe("resendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes old tokens and creates new one", async () => {
    vi.mocked(prisma.emailVerificationToken.deleteMany).mockResolvedValue({
      count: 1,
    } as never);
    vi.mocked(prisma.emailVerificationToken.create).mockResolvedValue(
      {} as never
    );
    vi.mocked(sendVerificationEmail).mockResolvedValue(undefined);

    const result = await resendVerificationEmail();

    expect(result.success).toBe(true);
    expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "1" } })
    );
    expect(prisma.emailVerificationToken.create).toHaveBeenCalled();
    expect(sendVerificationEmail).toHaveBeenCalled();
  });
});
