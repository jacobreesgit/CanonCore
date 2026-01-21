/**
 * Unit tests for user profile server actions.
 * Tests profile updates, password changes, and image uploads.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateProfile,
  changePassword,
  uploadProfileImage,
  uploadHeroImage,
  removeProfileImage,
  removeHeroImage,
  getProfile,
} from "@/lib/user-actions";
import { prisma } from "@/lib/prisma";
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

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Mock auth
const mockUserId = "user-123";
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: "user-123" },
  }),
}));

// Mock file-type
vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn(),
}));

// Mock sharp
vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    rotate: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  }),
}));

// Mock bcryptjs for password tests
vi.mock("bcryptjs", () => ({
  compare: vi.fn((password: string, hash: string) => {
    // "Password1" matches mock hash, anything else fails
    return Promise.resolve(
      password === "Password1" && hash === "mock-password-hash"
    );
  }),
  hash: vi.fn(() => Promise.resolve("$2a$12$mockedhashedpasswordvalue")),
}));

// Set BYPASS_RATE_LIMIT for tests
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

// Import auth and file-type after mocking
import { auth } from "@/lib/auth";
import { fileTypeFromBuffer } from "file-type";

/**
 * Creates a mock file with arrayBuffer method for testing.
 * Node.js File doesn't properly implement arrayBuffer(), so we create a mock.
 */
function createMockFile(
  content: Uint8Array,
  filename: string,
  mimeType: string
): File {
  return {
    name: filename,
    type: mimeType,
    size: content.length,
    arrayBuffer: async () => content.buffer,
  } as unknown as File;
}

/**
 * Creates a mock FormData that returns our mock file.
 * FormData.get() in Node.js doesn't preserve the arrayBuffer method.
 */
function createMockFormData(file: File | null): FormData {
  return {
    get: (key: string) => (key === "file" ? file : null),
  } as unknown as FormData;
}

/**
 * Creates a mock user object for Prisma.
 */
function createMockUser(overrides = {}) {
  return {
    id: mockUserId,
    email: "test@example.com",
    passwordHash: "mock-password-hash", // Matches bcrypt mock for "Password1"
    emailVerified: null,
    name: "Test User",
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

describe("updateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
  });

  it("updates name without password", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue(
      createMockUser({ name: "New Name" })
    );

    const result = await updateProfile({ name: "New Name" });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { name: "New Name" },
    });
  });

  it("updates email with correct password", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(createMockUser()) // For password check
      .mockResolvedValueOnce(null); // For email uniqueness check
    vi.mocked(prisma.user.update).mockResolvedValue(
      createMockUser({ email: "new@example.com" })
    );

    const result = await updateProfile({
      email: "new@example.com",
      currentPassword: "Password1",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { email: "new@example.com" },
    });
  });

  it("rejects email change without password", async () => {
    const result = await updateProfile({ email: "new@example.com" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Current password required to change email");
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects email change with wrong password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser());

    const result = await updateProfile({
      email: "new@example.com",
      currentPassword: "WrongPassword1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Incorrect password");
    }
  });

  it("validates email format", async () => {
    const result = await updateProfile({
      email: "invalid-email",
      currentPassword: "Password1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("checks email uniqueness", async () => {
    vi.mocked(prisma.user.findUnique)
      .mockResolvedValueOnce(createMockUser()) // For password check
      .mockResolvedValueOnce(createMockUser({ email: "taken@example.com" })); // Existing user

    const result = await updateProfile({
      email: "taken@example.com",
      currentPassword: "Password1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Email already in use");
    }
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await updateProfile({ name: "Test" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
  });

  it("changes password with correct current password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser());
    vi.mocked(prisma.user.update).mockResolvedValue(createMockUser());

    const result = await changePassword({
      currentPassword: "Password1",
      newPassword: "NewPassword2",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: { passwordHash: expect.any(String) },
    });
  });

  it("rejects wrong current password", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser());

    const result = await changePassword({
      currentPassword: "WrongPassword1",
      newPassword: "NewPassword2",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Incorrect current password");
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("enforces password strength requirements", async () => {
    const result = await changePassword({
      currentPassword: "Password1",
      newPassword: "weak",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("hashes new password before storing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(createMockUser());
    vi.mocked(prisma.user.update).mockResolvedValue(createMockUser());

    await changePassword({
      currentPassword: "Password1",
      newPassword: "NewPassword2",
    });

    const updateCall = vi.mocked(prisma.user.update).mock.calls[0][0];
    expect(updateCall.data.passwordHash).not.toBe("NewPassword2");
    expect((updateCall.data.passwordHash as string).length).toBeGreaterThan(20);
  });

  it("applies rate limiting", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Rate limit exceeded",
    });

    const result = await changePassword({
      currentPassword: "Password1",
      newPassword: "NewPassword2",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Rate limit exceeded");
    }
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await changePassword({
      currentPassword: "Password1",
      newPassword: "NewPassword2",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});

describe("uploadProfileImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
  });

  it("uploads valid JPEG image", async () => {
    const imageBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({
      ext: "jpg",
      mime: "image/jpeg",
    });
    vi.mocked(prisma.user.update).mockResolvedValue(createMockUser());

    const mockFile = createMockFile(imageBuffer, "test.jpg", "image/jpeg");
    const formData = createMockFormData(mockFile);

    const result = await uploadProfileImage(formData);

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: {
        image: expect.any(Uint8Array),
        imageMime: "image/jpeg",
      },
    });
  });

  it("validates magic bytes (not just MIME header)", async () => {
    // File with wrong magic bytes but correct extension
    const fakeImageBuffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    vi.mocked(fileTypeFromBuffer).mockResolvedValue(undefined);

    const mockFile = createMockFile(fakeImageBuffer, "fake.jpg", "image/jpeg");
    const formData = createMockFormData(mockFile);

    const result = await uploadProfileImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Invalid image format. Allowed: JPEG, PNG, WebP"
      );
    }
  });

  it("rejects spoofed MIME type", async () => {
    // Executable file pretending to be image
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({
      ext: "exe",
      mime: "application/x-msdownload",
    });

    const mockFile = createMockFile(
      new Uint8Array([0x4d, 0x5a]),
      "malware.jpg",
      "image/jpeg"
    );
    const formData = createMockFormData(mockFile);

    const result = await uploadProfileImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Invalid image format. Allowed: JPEG, PNG, WebP"
      );
    }
  });

  it("rejects file exceeding size limit (1MB)", async () => {
    const largeBuffer = new Uint8Array(1.5 * 1024 * 1024); // 1.5MB
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({
      ext: "jpg",
      mime: "image/jpeg",
    });

    const mockFile = createMockFile(largeBuffer, "large.jpg", "image/jpeg");
    const formData = createMockFormData(mockFile);

    const result = await uploadProfileImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File too large. Maximum size is 1MB");
    }
  });

  it("returns error when no file provided", async () => {
    const formData = createMockFormData(null);

    const result = await uploadProfileImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("No file provided");
    }
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const mockFile = createMockFile(
      new Uint8Array([1, 2, 3]),
      "test.jpg",
      "image/jpeg"
    );
    const formData = createMockFormData(mockFile);

    const result = await uploadProfileImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});

describe("uploadHeroImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
  });

  it("uploads valid PNG image", async () => {
    const imageBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({
      ext: "png",
      mime: "image/png",
    });
    vi.mocked(prisma.user.update).mockResolvedValue(createMockUser());

    const mockFile = createMockFile(imageBuffer, "hero.png", "image/png");
    const formData = createMockFormData(mockFile);

    const result = await uploadHeroImage(formData);

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: {
        heroImage: expect.any(Uint8Array),
        heroImageMime: "image/png",
      },
    });
  });

  it("validates magic bytes for hero images", async () => {
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({
      ext: "gif",
      mime: "image/gif",
    });

    const mockFile = createMockFile(
      new Uint8Array([0x47, 0x49, 0x46]),
      "hero.gif",
      "image/gif"
    );
    const formData = createMockFormData(mockFile);

    const result = await uploadHeroImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(
        "Invalid image format. Allowed: JPEG, PNG, WebP"
      );
    }
  });

  it("rejects file exceeding size limit (2MB)", async () => {
    const largeBuffer = new Uint8Array(2.5 * 1024 * 1024); // 2.5MB
    vi.mocked(fileTypeFromBuffer).mockResolvedValue({
      ext: "jpg",
      mime: "image/jpeg",
    });

    const mockFile = createMockFile(
      largeBuffer,
      "large-hero.jpg",
      "image/jpeg"
    );
    const formData = createMockFormData(mockFile);

    const result = await uploadHeroImage(formData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("File too large. Maximum size is 2MB");
    }
  });
});

describe("removeProfileImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
  });

  it("removes profile image", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue(createMockUser());

    const result = await removeProfileImage();

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: {
        image: null,
        imageMime: null,
      },
    });
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await removeProfileImage();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});

describe("removeHeroImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
  });

  it("removes hero image", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue(createMockUser());

    const result = await removeHeroImage();

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: mockUserId },
      data: {
        heroImage: null,
        heroImageMime: null,
      },
    });
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await removeHeroImage();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});

describe("getProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: mockUserId } } as never);
  });

  it("returns profile data", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({
        name: "Test User",
        email: "test@example.com",
        image: new Uint8Array([1, 2, 3]),
        heroImage: null,
      })
    );

    const result = await getProfile();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: mockUserId,
        name: "Test User",
        email: "test@example.com",
        username: null,
        hasImage: true,
        hasHeroImage: false,
      });
    }
  });

  it("returns hasImage: false when no image", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(
      createMockUser({ image: null, heroImage: null })
    );

    const result = await getProfile();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.hasImage).toBe(false);
      expect(result.data?.hasHeroImage).toBe(false);
    }
  });

  it("returns error when user not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await getProfile();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("User not found");
    }
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null as never);

    const result = await getProfile();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Not authenticated");
    }
  });
});
