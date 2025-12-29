import { describe, it, expect, vi, beforeEach } from "vitest";
import { signUp, forgotPassword, resetPassword } from "@/lib/auth-actions";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates user with hashed password when email is new", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "1",
      email: "test@example.com",
      passwordHash: "hashed",
      emailVerified: null,
      name: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "1",
      email: "exists@example.com",
      passwordHash: "hashed",
      emailVerified: null,
      name: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await signUp("exists@example.com", "Password123!");

    expect(result.error).toBe("An account with this email already exists");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("hashes password before storing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: "1",
      email: "test@example.com",
      passwordHash: "hashed",
      emailVerified: null,
      name: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await signUp("test@example.com", "plainPassword");

    const createCall = vi.mocked(prisma.user.create).mock.calls[0][0];
    expect(createCall.data.passwordHash).not.toBe("plainPassword");
    expect(createCall.data.passwordHash.length).toBeGreaterThan(20);
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
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "hashed",
      emailVerified: null,
      name: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
    });
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
    });
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      passwordHash: "new-hash",
      emailVerified: null,
      name: null,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
});
