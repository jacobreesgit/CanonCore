/**
 * Integration tests for user profile actions.
 * Tests profile updates, password changes, and image uploads with real database.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { hash } from "bcryptjs";
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
import "../setup";

// Mock next/headers for server action context
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

// Mock file-type for image validation
vi.mock("file-type", () => ({
  fileTypeFromBuffer: vi.fn().mockResolvedValue({
    ext: "jpg",
    mime: "image/jpeg",
  }),
}));

// Mock sharp for EXIF stripping
vi.mock("sharp", () => ({
  default: vi.fn().mockReturnValue({
    rotate: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  }),
}));

// Bypass rate limiting
vi.stubEnv("BYPASS_RATE_LIMIT", "true");

// Track the current test user ID for mocking auth
let currentTestUserId: string | null = null;

// Mock auth to return current test user
vi.mock("@/lib/auth", () => ({
  auth: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        currentTestUserId ? { user: { id: currentTestUserId } } : null
      )
    ),
}));

/**
 * Creates a test user with a known password.
 */
async function createTestUser(emailSuffix: string) {
  const email = `profile-${Date.now()}-${emailSuffix}@test.example.com`;
  const passwordHash = await hash("Password1", 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: "Test User",
      passwordHash,
    },
  });

  currentTestUserId = user.id;
  return { user, email };
}

describe("updateProfile integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("persists name change to database", async () => {
    const { user } = await createTestUser("name");

    const result = await updateProfile({ name: "New Name" });
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.name).toBe("New Name");
  });

  it("persists email change to database", async () => {
    const { user } = await createTestUser("email");
    const newEmail = `updated-${Date.now()}@test.example.com`;

    const result = await updateProfile({
      email: newEmail,
      currentPassword: "Password1",
    });
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.email).toBe(newEmail);
  });

  it("requires correct password for email change", async () => {
    const { user } = await createTestUser("email-wrong-pass");
    const newEmail = `updated-${Date.now()}@test.example.com`;

    const result = await updateProfile({
      email: newEmail,
      currentPassword: "WrongPassword1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Incorrect password");
    }

    // Email should be unchanged
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.email).not.toBe(newEmail);
  });

  it("prevents duplicate email", async () => {
    const { user: user1 } = await createTestUser("dup1");
    const { user: user2 } = await createTestUser("dup2");

    // Try to change user2's email to user1's email
    currentTestUserId = user2.id;
    const result = await updateProfile({
      email: user1.email,
      currentPassword: "Password1",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Email already in use");
    }
  });
});

describe("changePassword integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("updates password hash in database", async () => {
    const { user } = await createTestUser("pass");
    const oldHash = user.passwordHash;

    const result = await changePassword({
      currentPassword: "Password1",
      newPassword: "NewPassword2",
    });
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.passwordHash).not.toBe(oldHash);
    expect(updated?.passwordHash).not.toBe("NewPassword2"); // Should be hashed
  });

  it("requires correct current password", async () => {
    const { user } = await createTestUser("pass-wrong");
    const oldHash = user.passwordHash;

    const result = await changePassword({
      currentPassword: "WrongPassword1",
      newPassword: "NewPassword2",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Incorrect current password");
    }

    // Password should be unchanged
    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.passwordHash).toBe(oldHash);
  });
});

describe("image upload integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("stores profile image binary and MIME in database", async () => {
    const { user } = await createTestUser("img");
    const imageData = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([imageData], { type: "image/jpeg" }),
      "test.jpg"
    );

    const result = await uploadProfileImage(formData);
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true, imageMime: true },
    });
    expect(updated?.image).not.toBeNull();
    expect(updated?.imageMime).toBe("image/jpeg");
  });

  it("stores hero image binary and MIME in database", async () => {
    const { user } = await createTestUser("hero");
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([imageData], { type: "image/png" }),
      "hero.png"
    );

    const result = await uploadHeroImage(formData);
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { heroImage: true, heroImageMime: true },
    });
    expect(updated?.heroImage).not.toBeNull();
    expect(updated?.heroImageMime).toBe("image/jpeg"); // Validated type from mock
  });
});

describe("image removal integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("clears profile image fields", async () => {
    const { user } = await createTestUser("rm-img");

    // First upload an image
    await prisma.user.update({
      where: { id: user.id },
      data: {
        image: new Uint8Array([1, 2, 3]) as Uint8Array<ArrayBuffer>,
        imageMime: "image/jpeg",
      },
    });

    const result = await removeProfileImage();
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { image: true, imageMime: true },
    });
    expect(updated?.image).toBeNull();
    expect(updated?.imageMime).toBeNull();
  });

  it("clears hero image fields", async () => {
    const { user } = await createTestUser("rm-hero");

    // First upload an image
    await prisma.user.update({
      where: { id: user.id },
      data: {
        heroImage: new Uint8Array([1, 2, 3]) as Uint8Array<ArrayBuffer>,
        heroImageMime: "image/png",
      },
    });

    const result = await removeHeroImage();
    expect(result.success).toBe(true);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { heroImage: true, heroImageMime: true },
    });
    expect(updated?.heroImage).toBeNull();
    expect(updated?.heroImageMime).toBeNull();
  });
});

describe("getProfile integration", () => {
  beforeEach(() => {
    currentTestUserId = null;
  });

  it("returns profile data from database", async () => {
    const { user, email } = await createTestUser("get");

    const result = await getProfile();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: user.id,
        name: "Test User",
        email,
        username: null,
        hasImage: false,
        hasHeroImage: false,
      });
    }
  });

  it("reflects image presence correctly", async () => {
    const { user } = await createTestUser("get-img");

    // Add profile image
    await prisma.user.update({
      where: { id: user.id },
      data: {
        image: new Uint8Array([1, 2, 3]) as Uint8Array<ArrayBuffer>,
        imageMime: "image/jpeg",
      },
    });

    const result = await getProfile();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.hasImage).toBe(true);
      expect(result.data?.hasHeroImage).toBe(false);
    }
  });
});
