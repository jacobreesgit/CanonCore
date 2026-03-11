/**
 * Unit tests for E2E automatic setup and recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock googleapis
vi.mock("googleapis", () => {
  const mockDrive = {
    files: {
      get: vi.fn(),
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      emptyTrash: vi.fn(),
    },
  };

  return {
    google: {
      auth: {
        OAuth2: class MockOAuth2 {
          setCredentials = vi.fn();
        },
      },
      drive: vi.fn().mockReturnValue(mockDrive),
    },
  };
});

// Mock Prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    googleDriveConnection: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    item: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    itemFile: {
      findFirst: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock bcryptjs
vi.mock("bcryptjs", () => ({
  hash: vi.fn().mockResolvedValue("hashed-password"),
}));

// Mock crypto
vi.mock("@/lib/crypto", () => ({
  encryptCredential: vi.fn().mockReturnValue("encrypted"),
}));

// Mock fs for video file checks
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    statSync: vi.fn().mockReturnValue({ size: 17889792 }),
    createReadStream: vi.fn(),
  };
});

describe("e2e-setup", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_E2E_REFRESH_TOKEN = "test-refresh-token";
    process.env.GOOGLE_E2E_ROOT_FOLDER_ID = "test-root-folder-id";
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("restoreRootFolderIfTrashed", () => {
    it("returns true when folder is not trashed", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "test-id", name: "E2E Root", trashed: false },
      } as never);

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(true);
    });

    it("restores folder when trashed and returns true", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "test-id", name: "E2E Root", trashed: true },
      } as never);
      vi.mocked(mockDrive.files.update).mockResolvedValue({
        data: { id: "test-id", trashed: false },
      } as never);

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(true);
      expect(mockDrive.files.update).toHaveBeenCalledWith({
        fileId: "test-root-folder-id",
        requestBody: { trashed: false },
      });
    });

    it("returns false when folder not found", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockRejectedValue({ code: 404 });

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      const result = await restoreRootFolderIfTrashed();
      expect(result).toBe(false);
    });

    it("throws on API errors other than 404", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockRejectedValue({
        code: 403,
        message: "Rate Limit Exceeded",
      });

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      await expect(restoreRootFolderIfTrashed()).rejects.toMatchObject({
        code: 403,
      });
    });

    it("throws when restore operation fails", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "test-id", name: "E2E Root", trashed: true },
      } as never);
      vi.mocked(mockDrive.files.update).mockRejectedValue({
        code: 500,
        message: "Internal Server Error",
      });

      const { restoreRootFolderIfTrashed } = await import("@/lib/e2e-setup");
      await expect(restoreRootFolderIfTrashed()).rejects.toMatchObject({
        code: 500,
      });
    });
  });

  describe("ensureTestFolderExists", () => {
    it("returns existing folder ID when folder exists", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [{ id: "existing-folder-id", name: "Breaking Bad" }] },
      } as never);

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      const result = await ensureTestFolderExists();
      expect(result).toBe("existing-folder-id");
    });

    it("creates folder when missing and returns new ID", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [] },
      } as never);
      vi.mocked(mockDrive.files.create).mockResolvedValue({
        data: { id: "new-folder-id" },
      } as never);

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      const result = await ensureTestFolderExists();
      expect(result).toBe("new-folder-id");
      expect(mockDrive.files.create).toHaveBeenCalled();
    });

    it("throws when Drive API quota exceeded", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.list).mockRejectedValue({
        code: 403,
        message: "User Rate Limit Exceeded",
      });

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      await expect(ensureTestFolderExists()).rejects.toMatchObject({
        code: 403,
      });
    });

    it("throws when folder creation fails", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [] },
      } as never);
      vi.mocked(mockDrive.files.create).mockRejectedValue({
        code: 507,
        message: "Insufficient Storage",
      });

      const { ensureTestFolderExists } = await import("@/lib/e2e-setup");
      await expect(ensureTestFolderExists()).rejects.toMatchObject({
        code: 507,
      });
    });
  });

  describe("ensureVideoFileExists", () => {
    it("returns true when video already exists in Drive", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [{ id: "video-id", name: "test.mp4" }] },
      } as never);

      const { ensureVideoFileExists } = await import("@/lib/e2e-setup");
      const result = await ensureVideoFileExists("folder-id");
      expect(result).toEqual({
        exists: true,
        fileId: "video-id",
        fileName: "test.mp4",
      });
    });

    it("returns false with reason when video missing and no local file", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.list).mockResolvedValue({
        data: { files: [] },
      } as never);

      const { ensureVideoFileExists } = await import("@/lib/e2e-setup");
      // Will return false because local file doesn't exist in test env
      const result = await ensureVideoFileExists("folder-id");
      expect(result.exists).toBe(false);
      expect(result.reason).toContain("local");
    });
  });

  describe("ensureE2EUserExists", () => {
    it("returns existing user when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "existing-user-id",
        email: "e2e-drive-test@canoncore.test",
      } as never);

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      const result = await ensureE2EUserExists();
      expect(result).toBe("existing-user-id");
    });

    it("creates user when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: "new-user-id",
        email: "e2e-drive-test@canoncore.test",
      } as never);

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      const result = await ensureE2EUserExists();
      expect(result).toBe("new-user-id");
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it("throws on database connection failure", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockRejectedValue(
        new Error("Connection refused")
      );

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      await expect(ensureE2EUserExists()).rejects.toThrow("Connection refused");
    });

    it("throws on unique constraint violation during create", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockRejectedValue(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      );

      const { ensureE2EUserExists } = await import("@/lib/e2e-setup");
      await expect(ensureE2EUserExists()).rejects.toThrow(
        "Unique constraint failed"
      );
    });
  });

  describe("ensureDriveConnectionExists", () => {
    it("returns existing connection ID when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
        id: "existing-connection-id",
        userId: "user-id",
      } as never);

      const { ensureDriveConnectionExists } = await import("@/lib/e2e-setup");
      const result = await ensureDriveConnectionExists("user-id");
      expect(result).toBe("existing-connection-id");
    });

    it("creates connection when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue(
        null
      );
      vi.mocked(prisma.googleDriveConnection.create).mockResolvedValue({
        id: "new-connection-id",
        userId: "user-id",
      } as never);

      const { ensureDriveConnectionExists } = await import("@/lib/e2e-setup");
      const result = await ensureDriveConnectionExists("user-id");
      expect(result).toBe("new-connection-id");
      expect(prisma.googleDriveConnection.create).toHaveBeenCalled();
    });
  });

  describe("ensureItemRecordExists", () => {
    it("returns existing item ID when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.item.findFirst).mockResolvedValue({
        id: "existing-item-id",
        name: "Breaking Bad",
        driveFileId: "folder-id",
      } as never);

      const { ensureItemRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemRecordExists("user-id", "folder-id");
      expect(result).toBe("existing-item-id");
    });

    it("creates item when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.item.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.item.create).mockResolvedValue({
        id: "new-item-id",
        name: "Breaking Bad",
      } as never);

      const { ensureItemRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemRecordExists("user-id", "folder-id");
      expect(result).toBe("new-item-id");
      expect(prisma.item.create).toHaveBeenCalled();
    });
  });

  describe("ensureItemFileRecordExists", () => {
    it("returns existing when found", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue({
        id: "existing-file-id",
        driveFileId: "video-id",
      } as never);

      const { ensureItemFileRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemFileRecordExists(
        "item-id",
        "video-id",
        "test.mp4"
      );
      expect(result).toBe("existing-file-id");
    });

    it("creates record when missing", async () => {
      const { prisma } = await import("@/lib/prisma");
      vi.mocked(prisma.itemFile.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.itemFile.create).mockResolvedValue({
        id: "new-file-id",
        driveFileId: "video-id",
      } as never);

      const { ensureItemFileRecordExists } = await import("@/lib/e2e-setup");
      const result = await ensureItemFileRecordExists(
        "item-id",
        "video-id",
        "test.mp4"
      );
      expect(result).toBe("new-file-id");
      expect(prisma.itemFile.create).toHaveBeenCalled();
    });
  });

  describe("runAutomaticSetup", () => {
    it("returns error when root folder permanently deleted", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockRejectedValue({ code: 404 });

      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("permanently deleted");
    });

    it("returns error when video missing and no local file", async () => {
      const { google } = await import("googleapis");
      const { prisma } = await import("@/lib/prisma");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;

      // Root folder OK
      vi.mocked(mockDrive.files.get).mockResolvedValue({
        data: { id: "root-id", name: "E2E Root", trashed: false },
      } as never);
      // Test folder exists
      vi.mocked(mockDrive.files.list)
        .mockResolvedValueOnce({
          data: { files: [{ id: "folder-id", name: "Breaking Bad" }] },
        } as never)
        // No video in folder
        .mockResolvedValueOnce({
          data: { files: [] },
        } as never);
      // User exists (parallel operation)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "user-id",
        email: "e2e-drive-test@canoncore.test",
      } as never);

      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("local");
    });

    it("catches and returns errors from any step", async () => {
      const { google } = await import("googleapis");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDrive = google.drive({} as never) as any;
      vi.mocked(mockDrive.files.get).mockRejectedValue(
        new Error("Network timeout")
      );

      const { runAutomaticSetup } = await import("@/lib/e2e-setup");
      const result = await runAutomaticSetup();
      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });
  });
});
