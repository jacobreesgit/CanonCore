/**
 * Unit tests for item actions.
 * Tests all CRUD operations with mocked Prisma and auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import {
  getItems,
  getAllItems,
  getItem,
  getDescendants,
  createItem,
  updateItem,
  deleteItem,
  reorderItems,
  getSearchableItems,
} from "@/lib/item-actions";
import { getMediaIconType } from "@/lib/item-utils";
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

// Mock auth - cast to bypass complex next-auth types
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock google-drive-client for batch operations
vi.mock("@/lib/google-drive-client", () => ({
  batchDelete: vi.fn(),
}));

// Mock crypto for token decryption
vi.mock("@/lib/crypto", () => ({
  decryptCredential: vi.fn().mockReturnValue("decrypted-access-token"),
}));

const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

/** Helper to create a mock session */
const mockSession = (userId: string, email: string): Session => ({
  user: { id: userId, email },
  expires: new Date().toISOString(),
});

/** Helper to create a mock item with all required fields */
const mockItem = (overrides: {
  id: string;
  name: string;
  description?: string | null;
  parentId: string | null;
  order: number;
  depth: number;
  userId: string;
  artworkId?: string | null;
}) => ({
  ...overrides,
  description: overrides.description ?? null,
  type: "FOLDER" as const,
  pinnedOrder: null,
  // Google Drive fields
  driveFileId: null,
  driveModifiedAt: null,
  driveThumbnailUrl: null,
  syncStatus: "SYNCED" as const,
  syncError: null,
  driveConnectionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Include files array with fileType and isPrimary for fileCounts support
  files: overrides.artworkId
    ? [{ id: overrides.artworkId, fileType: "ARTWORK", isPrimary: true }]
    : [],
  driveConnection: null,
});

describe("getItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getItems(null);

    expect(result.error).toBe("Unauthorized");
  });

  it("returns root items when parentId is null", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      mockItem({
        id: "item-1",
        name: "Folder 1",
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      }),
      mockItem({
        id: "item-2",
        name: "Folder 2",
        parentId: null,
        order: 1,
        depth: 0,
        userId: "user-1",
      }),
    ]);

    const result = await getItems(null);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
    }
    // Verify the main items query (second findMany call)
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", parentId: null },
      orderBy: { order: "asc" },
      include: {
        files: {
          select: {
            id: true,
            fileType: true,
            isPrimary: true,
            filename: true,
            mimeType: true,
          },
        },
        driveConnection: {
          select: { id: true },
        },
      },
    });
  });

  it("returns children when parentId is provided", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      mockItem({
        id: "child-1",
        name: "Child",
        parentId: "parent-1",
        order: 0,
        depth: 1,
        userId: "user-1",
      }),
    ]);

    const result = await getItems("parent-1");

    expect(result.success).toBe(true);
    // Verify the main items query (second findMany call)
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", parentId: "parent-1" },
      orderBy: { order: "asc" },
      include: {
        files: {
          select: {
            id: true,
            fileType: true,
            isPrimary: true,
            filename: true,
            mimeType: true,
          },
        },
        driveConnection: {
          select: { id: true },
        },
      },
    });
  });
});

describe("getAllItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all items for user regardless of parent", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      { id: "root1", parentId: null, name: "Root 1", depth: 0 },
      { id: "child1", parentId: "root1", name: "Child 1", depth: 1 },
      { id: "grandchild1", parentId: "child1", name: "Grandchild 1", depth: 2 },
      { id: "root2", parentId: null, name: "Root 2", depth: 0 },
    ];

    vi.mocked(prisma.item.findMany)
      .mockResolvedValueOnce(mockItems as never) // For descendant count
      .mockResolvedValueOnce(
        mockItems.map((item) => ({
          ...item,
          description: null,
          order: 0,
          pinnedOrder: null,
          userId: "user-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          // Google Drive fields
          driveFileId: null,
          driveModifiedAt: null,
          driveThumbnailUrl: null,
          syncStatus: "SYNCED" as const,
          syncError: null,
          driveConnectionId: null,
          files: [],
          driveConnection: null,
        })) as never
      );

    const result = await getAllItems();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(4);
      expect(result.data?.map((i) => i.id)).toEqual([
        "root1",
        "child1",
        "grandchild1",
        "root2",
      ]);
    }
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getAllItems();

    expect(result.error).toBe("Unauthorized");
  });
});

describe("getDescendants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all descendants of an item", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      { id: "child1", parentId: "parent1", depth: 1 },
      { id: "grandchild1", parentId: "child1", depth: 2 },
      { id: "grandchild2", parentId: "child1", depth: 2 },
    ];

    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      id: "parent1",
      userId: "user-123",
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue(
      mockItems.map((item) => ({ id: item.id }))
    );
    // Single findMany call now (optimized to combine count + data queries)
    vi.mocked(prisma.item.findMany).mockResolvedValueOnce(
      mockItems.map((item) => ({
        ...item,
        name: "Item",
        description: null,
        order: 0,
        pinnedOrder: null,
        userId: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        // Google Drive fields
        driveFileId: null,
        driveModifiedAt: null,
        driveThumbnailUrl: null,
        syncStatus: "SYNCED" as const,
        syncError: null,
        driveConnectionId: null,
        files: [],
        driveConnection: null,
      })) as never
    );

    const result = await getDescendants("parent1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(3);
    }
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getDescendants("parent1");

    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

    const result = await getDescendants("nonexistent");

    expect(result.error).toBe("Item not found");
  });
});

describe("getItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getItem("item-1");

    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    const result = await getItem("nonexistent");

    expect(result.error).toBe("Item not found");
  });

  it("returns error when item belongs to another user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue(
      mockItem({
        id: "item-1",
        name: "Folder",
        parentId: null,
        order: 0,
        depth: 0,
        userId: "other-user",
      })
    );

    const result = await getItem("item-1");

    expect(result.error).toBe("Unauthorized");
  });

  it("returns item with ancestors for breadcrumbs", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    // Mock findUnique to return the item
    vi.mocked(prisma.item.findUnique).mockResolvedValueOnce(
      mockItem({
        id: "child-1",
        name: "Child",
        parentId: "parent-1",
        order: 0,
        depth: 1,
        userId: "user-1",
      })
    );

    // Mock $queryRaw to return ancestors from recursive CTE
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      { id: "parent-1", name: "Parent" },
    ]);

    const result = await getItem("child-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data?.ancestors).toHaveLength(1);
      expect(result.data?.ancestors[0].name).toBe("Parent");
    }
  });
});

describe("createItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await createItem(null, "New Folder");

    expect(result.error).toBe("Unauthorized");
  });

  it("returns validation error for empty name", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const result = await createItem(null, "");

    expect(result.error).toBe("Name is required");
  });

  it("returns validation error for invalid characters", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const result = await createItem(null, "Folder/with/slashes");

    expect(result.error).toContain("can only contain");
  });

  it("creates root item with order 0 when no siblings exist", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.aggregate).mockResolvedValue({
      _max: { order: null },
    } as never);
    vi.mocked(prisma.item.create).mockResolvedValue(
      mockItem({
        id: "new-item",
        name: "New Folder",
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      })
    );

    const result = await createItem(null, "New Folder");

    expect(result.success).toBe(true);
    expect(prisma.item.create).toHaveBeenCalledWith({
      data: {
        name: "New Folder",
        description: null,
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      },
    });
  });

  it("returns error when parent not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    const result = await createItem("nonexistent-parent", "Child");

    expect(result.error).toBe("Parent not found");
  });

  it("returns error when max depth exceeded", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "deep-parent",
      depth: 9, // At max depth (10 levels, 0-indexed)
      userId: "user-1",
    } as never);

    const result = await createItem("deep-parent", "Child");

    expect(result.error).toBe("Maximum nesting depth reached");
  });

  it("creates item with description", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.aggregate).mockResolvedValue({
      _max: { order: null },
    } as never);
    vi.mocked(prisma.item.create).mockResolvedValue(
      mockItem({
        id: "new-item",
        name: "Folder",
        description: "A test folder",
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      })
    );

    const result = await createItem(null, "Folder", "A test folder");

    expect(result.success).toBe(true);
    expect(prisma.item.create).toHaveBeenCalledWith({
      data: {
        name: "Folder",
        description: "A test folder",
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      },
    });
  });

  it("creates item without description when not provided", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.aggregate).mockResolvedValue({
      _max: { order: null },
    } as never);
    vi.mocked(prisma.item.create).mockResolvedValue(
      mockItem({
        id: "new-item",
        name: "Folder",
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      })
    );

    const result = await createItem(null, "Folder");

    expect(result.success).toBe(true);
    expect(prisma.item.create).toHaveBeenCalledWith({
      data: {
        name: "Folder",
        description: null,
        parentId: null,
        order: 0,
        depth: 0,
        userId: "user-1",
      },
    });
  });

  it("returns validation error for description over 1000 chars", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const result = await createItem(null, "Folder", "a".repeat(1001));

    expect(result.error).toContain("1000");
  });
});

describe("updateItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await updateItem("item-1", { name: "New Name" });

    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    const result = await updateItem("nonexistent", { name: "New Name" });

    expect(result.error).toBe("Item not found");
  });

  it("returns error when item belongs to another user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      userId: "other-user",
    } as never);

    const result = await updateItem("item-1", { name: "New Name" });

    expect(result.error).toBe("Unauthorized");
  });

  it("updates item name successfully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never);
    vi.mocked(prisma.item.update).mockResolvedValue({} as never);

    const result = await updateItem("item-1", { name: "New Name" });

    expect(result.success).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { name: "New Name" },
    });
  });

  it("updates item description", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never);
    vi.mocked(prisma.item.update).mockResolvedValue({} as never);

    const result = await updateItem("item-1", {
      description: "New description",
    });

    expect(result.success).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { description: "New description" },
    });
  });

  it("clears description when set to empty string", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never);
    vi.mocked(prisma.item.update).mockResolvedValue({} as never);

    const result = await updateItem("item-1", { description: "" });

    expect(result.success).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { description: null },
    });
  });

  it("updates both name and description", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never);
    vi.mocked(prisma.item.update).mockResolvedValue({} as never);

    const result = await updateItem("item-1", {
      name: "New Name",
      description: "New description",
    });

    expect(result.success).toBe(true);
    expect(prisma.item.update).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { name: "New Name", description: "New description" },
    });
  });
});

describe("deleteItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await deleteItem("item-1");

    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when item not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

    const result = await deleteItem("nonexistent");

    expect(result.error).toBe("Item not found");
  });

  it("deletes item successfully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      userId: "user-1",
    } as never);
    vi.mocked(prisma.item.delete).mockResolvedValue({} as never);

    const result = await deleteItem("item-1");

    expect(result.success).toBe(true);
    expect(prisma.item.delete).toHaveBeenCalledWith({
      where: { id: "item-1" },
    });
  });

  it("should check rate limit before processing", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });

    const result = await deleteItem("item-123");

    expect(checkRateLimit).toHaveBeenCalledWith("itemDelete");
    expect(result).toEqual({
      error: "Too many attempts. Please try again later.",
    });
  });

  it("should proceed when rate limit passes", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(null);

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "item-123",
      userId: "user-1",
      driveFileId: null,
      driveConnectionId: null,
    } as never);
    vi.mocked(prisma.item.delete).mockResolvedValue({} as never);

    const result = await deleteItem("item-123");

    expect(checkRateLimit).toHaveBeenCalledWith("itemDelete");
    expect(result).toEqual({ success: true });
  });

  it("uses batch delete when item has descendants with Drive files", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");
    vi.mocked(batchDelete).mockResolvedValue({
      succeeded: ["drive-1", "drive-2", "drive-3"],
      failed: [],
    });

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    // Parent item with driveFileId
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "parent-item",
      userId: "user-1",
      driveFileId: "drive-1",
      driveConnectionId: "conn-1",
    } as never);

    // Mock connection lookup
    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      encryptedAccessToken: "encrypted-token",
      encryptedRefreshToken: "encrypted-refresh",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as never);

    // Mock recursive CTE to return descendants with driveFileIds
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { driveFileId: "drive-2" },
      { driveFileId: "drive-3" },
      { driveFileId: null }, // A descendant without Drive file
    ]);

    vi.mocked(prisma.item.delete).mockResolvedValue({} as never);

    const result = await deleteItem("parent-item");

    expect(result.success).toBe(true);
    // Should call batchDelete with parent + descendant driveFileIds
    expect(batchDelete).toHaveBeenCalledWith(
      expect.any(String), // access token
      ["drive-1", "drive-2", "drive-3"]
    );
    expect(prisma.item.delete).toHaveBeenCalledWith({
      where: { id: "parent-item" },
    });
  });

  it("does not call batch delete when item has no Drive connection", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "local-item",
      userId: "user-1",
      driveFileId: null,
      driveConnectionId: null,
    } as never);
    vi.mocked(prisma.item.delete).mockResolvedValue({} as never);

    const result = await deleteItem("local-item");

    expect(result.success).toBe(true);
    expect(batchDelete).not.toHaveBeenCalled();
    expect(prisma.item.delete).toHaveBeenCalled();
  });

  it("continues with local delete when batch delete partially fails", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");
    vi.mocked(batchDelete).mockResolvedValue({
      succeeded: ["drive-1"],
      failed: [{ fileId: "drive-2", error: "Not found" }],
    });

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "parent-item",
      userId: "user-1",
      driveFileId: "drive-1",
      driveConnectionId: "conn-1",
    } as never);
    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      encryptedAccessToken: "encrypted-token",
      encryptedRefreshToken: "encrypted-refresh",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ driveFileId: "drive-2" }]);
    vi.mocked(prisma.item.delete).mockResolvedValue({} as never);

    const result = await deleteItem("parent-item");

    // Should still succeed - Drive delete is soft-delete (recoverable)
    expect(result.success).toBe(true);
    expect(prisma.item.delete).toHaveBeenCalled();
  });

  it("handles batch delete when only parent has Drive file (no descendants)", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");
    vi.mocked(batchDelete).mockResolvedValue({
      succeeded: ["drive-1"],
      failed: [],
    });

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findUnique).mockResolvedValue({
      id: "leaf-item",
      userId: "user-1",
      driveFileId: "drive-1",
      driveConnectionId: "conn-1",
    } as never);
    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      encryptedAccessToken: "encrypted-token",
      encryptedRefreshToken: "encrypted-refresh",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as never);
    // No descendants
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.item.delete).mockResolvedValue({} as never);

    const result = await deleteItem("leaf-item");

    expect(result.success).toBe(true);
    // Should still use batchDelete even for single file (simplifies code path)
    expect(batchDelete).toHaveBeenCalledWith(expect.any(String), ["drive-1"]);
  });
});

describe("reorderItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await reorderItems([{ id: "item-1", order: 0 }]);

    expect(result.error).toBe("Unauthorized");
  });

  it("returns success for empty updates array", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const result = await reorderItems([]);

    expect(result.success).toBe(true);
  });

  it("returns error when some items not found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-1", userId: "user-1", depth: 0 },
    ] as never);

    const result = await reorderItems([
      { id: "item-1", order: 0 },
      { id: "item-2", order: 1 },
    ]);

    expect(result.error).toBe("Some items not found");
  });

  it("returns error when item belongs to another user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-1", userId: "user-1", depth: 0 },
      { id: "item-2", userId: "other-user", depth: 0 },
    ] as never);

    const result = await reorderItems([
      { id: "item-1", order: 0 },
      { id: "item-2", order: 1 },
    ]);

    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when max depth exceeded", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-1", userId: "user-1", depth: 0 },
    ] as never);

    const result = await reorderItems([{ id: "item-1", order: 0, depth: 10 }]);

    expect(result.error).toBe("Maximum nesting depth reached");
  });

  it("performs batch update in transaction", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "item-1", userId: "user-1", depth: 0 },
      { id: "item-2", userId: "user-1", depth: 0 },
    ] as never);

    const result = await reorderItems([
      { id: "item-1", order: 1 },
      { id: "item-2", order: 0 },
    ]);

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe("getMediaIconType", () => {
  it("returns null for empty array", () => {
    expect(getMediaIconType([])).toBe(null);
  });

  it("returns 'music' for all audio files", () => {
    const files = [
      { mimeType: "audio/mpeg" },
      { mimeType: "audio/mp3" },
      { mimeType: "audio/wav" },
    ];
    expect(getMediaIconType(files)).toBe("music");
  });

  it("returns 'film' for all video files", () => {
    const files = [
      { mimeType: "video/mp4" },
      { mimeType: "video/webm" },
      { mimeType: "video/mkv" },
    ];
    expect(getMediaIconType(files)).toBe("film");
  });

  it("returns 'mixed' when both audio and video files exist", () => {
    const files = [{ mimeType: "audio/mpeg" }, { mimeType: "video/mp4" }];
    expect(getMediaIconType(files)).toBe("mixed");
  });

  it("treats null mimeType as video (default)", () => {
    const files = [{ mimeType: null }];
    expect(getMediaIconType(files)).toBe("film");
  });

  it("treats unknown mimeType as video (default)", () => {
    const files = [{ mimeType: "application/octet-stream" }];
    expect(getMediaIconType(files)).toBe("film");
  });

  it("returns 'mixed' when audio and null mimeType files exist", () => {
    const files = [{ mimeType: "audio/mpeg" }, { mimeType: null }];
    expect(getMediaIconType(files)).toBe("mixed");
  });

  it("handles single audio file", () => {
    expect(getMediaIconType([{ mimeType: "audio/flac" }])).toBe("music");
  });

  it("handles single video file", () => {
    expect(getMediaIconType([{ mimeType: "video/x-matroska" }])).toBe("film");
  });

  it("returns 'mixed' early when both types detected", () => {
    // This tests the early exit optimization - with many files,
    // it should return as soon as both types are found
    const files = [
      { mimeType: "audio/mpeg" },
      { mimeType: "video/mp4" },
      { mimeType: "audio/wav" },
      { mimeType: "video/webm" },
    ];
    expect(getMediaIconType(files)).toBe("mixed");
  });
});

describe("getSearchableItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all items with artwork and breadcrumbs for authenticated user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      {
        id: "item-1",
        name: "Star Wars",
        parentId: null,
        depth: 0,
        description: "A classic movie",
        files: [{ id: "artwork-123", isPrimary: true }],
      },
      {
        id: "item-2",
        name: "Empire Strikes Back",
        parentId: "item-1",
        depth: 1,
        description: null,
        files: [],
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getSearchableItems();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      // First item has artwork, no breadcrumb (root level)
      expect(result.data![0].artworkId).toBe("artwork-123");
      expect(result.data![0].breadcrumb).toBeNull();
      // Second item has no artwork, has breadcrumb
      expect(result.data![1].artworkId).toBeNull();
      expect(result.data![1].breadcrumb).toBe("Star Wars");
    }
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-123" },
      select: {
        id: true,
        name: true,
        parentId: true,
        depth: true,
        description: true,
        files: {
          where: { fileType: "ARTWORK" },
          select: { id: true, isPrimary: true },
          orderBy: { isPrimary: "desc" },
        },
      },
      orderBy: { name: "asc" },
      take: 500,
    });
  });

  it("uses first artwork when no primary artwork exists", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      {
        id: "item-1",
        name: "Star Wars",
        parentId: null,
        depth: 0,
        description: null,
        // Two artwork files, neither is primary - should use first one
        files: [
          { id: "artwork-1", isPrimary: false },
          { id: "artwork-2", isPrimary: false },
        ],
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getSearchableItems();

    expect(result.success).toBe(true);
    if (result.success) {
      // Should use first artwork file (sorted by isPrimary desc, so first non-primary)
      expect(result.data![0].artworkId).toBe("artwork-1");
    }
  });

  it("builds nested breadcrumb paths correctly", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));

    const mockItems = [
      {
        id: "item-1",
        name: "Movies",
        parentId: null,
        depth: 0,
        description: null,
        files: [],
      },
      {
        id: "item-2",
        name: "Star Wars",
        parentId: "item-1",
        depth: 1,
        description: null,
        files: [],
      },
      {
        id: "item-3",
        name: "Deleted Scenes",
        parentId: "item-2",
        depth: 2,
        description: null,
        files: [],
      },
    ];

    vi.mocked(prisma.item.findMany).mockResolvedValue(mockItems as never);

    const result = await getSearchableItems();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data![0].breadcrumb).toBeNull(); // Movies (root)
      expect(result.data![1].breadcrumb).toBe("Movies"); // Star Wars
      expect(result.data![2].breadcrumb).toBe("Movies / Star Wars"); // Deleted Scenes
    }
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getSearchableItems();

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Not authenticated");
  });

  it("limits results to 500 items for performance", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await getSearchableItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
      })
    );
  });

  it("handles database errors gracefully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-123", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockRejectedValue(new Error("DB error"));

    const result = await getSearchableItems();

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Failed to fetch items");
  });

  it("returns error when rate limited", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });

    const result = await getSearchableItems();

    expect(result.success).toBeFalsy();
    expect(result.error).toBe("Too many attempts. Please try again later.");
    // Should not reach authentication or database
    expect(prisma.item.findMany).not.toHaveBeenCalled();
  });
});

describe("deleteItems (bulk)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["item-1", "item-2"]);

    expect(result.error).toBe("Not authenticated");
  });

  it("returns error for empty array", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems([]);

    expect(result.error).toBe("No items to delete");
  });

  it("deletes multiple items successfully", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", driveFileId: null, driveConnectionId: null },
      { id: "2", userId: "user-1", driveFileId: null, driveConnectionId: null },
      { id: "3", userId: "user-1", driveFileId: null, driveConnectionId: null },
    ] as never);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 3 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["1", "2", "3"]);

    expect(result.success).toBe(true);
    expect("data" in result && result.data?.deleted).toBe(3);
  });

  it("only deletes items owned by user", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    // Only item 1 belongs to user, item 2 would not be returned
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", driveFileId: null, driveConnectionId: null },
    ] as never);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["1", "2"]);

    expect(result.success).toBe(true);
    expect("data" in result && result.data?.deleted).toBe(1);
    expect("data" in result && result.data?.skipped).toBe(1);
  });

  it("returns error when no owned items found", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    // No items returned - none owned by user
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["1", "2"]);

    expect(result.error).toBe("No items found to delete");
  });

  it("handles items with Drive files", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "1",
        userId: "user-1",
        driveFileId: "drive-1",
        driveConnectionId: "conn-1",
      },
    ] as never);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["1"]);

    expect(result.success).toBe(true);
    expect("data" in result && result.data?.deleted).toBe(1);
  });

  it("should check rate limit before processing", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      error: "Too many attempts. Please try again later.",
    });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["item-1", "item-2"]);

    expect(checkRateLimit).toHaveBeenCalledWith("itemDelete");
    expect(result).toEqual({
      error: "Too many attempts. Please try again later.",
    });
  });

  it("should proceed when rate limit passes", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce(null);

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", driveFileId: null, driveConnectionId: null },
      { id: "2", userId: "user-1", driveFileId: null, driveConnectionId: null },
    ] as never);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 2 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["1", "2"]);

    expect(checkRateLimit).toHaveBeenCalledWith("itemDelete");
    expect(result.success).toBe(true);
    expect("data" in result && result.data?.deleted).toBe(2);
  });

  it("uses batch delete for items with Drive files", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");
    vi.mocked(batchDelete).mockResolvedValue({
      succeeded: ["drive-1", "drive-2"],
      failed: [],
    });

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        userId: "user-1",
        driveFileId: "drive-1",
        driveConnectionId: "conn-1",
      },
      {
        id: "item-2",
        userId: "user-1",
        driveFileId: "drive-2",
        driveConnectionId: "conn-1",
      },
    ] as never);
    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      encryptedAccessToken: "encrypted-token",
      encryptedRefreshToken: "encrypted-refresh",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as never);
    // No descendants
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 2 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["item-1", "item-2"]);

    expect(result.success).toBe(true);
    expect(batchDelete).toHaveBeenCalledWith(expect.any(String), [
      "drive-1",
      "drive-2",
    ]);
  });

  it("batch deletes Drive files including descendants", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");
    vi.mocked(batchDelete).mockResolvedValue({
      succeeded: ["drive-1", "drive-child-1", "drive-child-2"],
      failed: [],
    });

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "parent-item",
        userId: "user-1",
        driveFileId: "drive-1",
        driveConnectionId: "conn-1",
      },
    ] as never);
    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      encryptedAccessToken: "encrypted-token",
      encryptedRefreshToken: "encrypted-refresh",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as never);
    // Descendants with Drive files
    vi.mocked(prisma.$queryRaw).mockResolvedValue([
      { driveFileId: "drive-child-1" },
      { driveFileId: "drive-child-2" },
      { driveFileId: null }, // Descendant without Drive file
    ]);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["parent-item"]);

    expect(result.success).toBe(true);
    // Should include parent + non-null descendants
    expect(batchDelete).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(["drive-1", "drive-child-1", "drive-child-2"])
    );
  });

  it("continues with local delete when Drive batch delete fails", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");
    vi.mocked(batchDelete).mockRejectedValue(new Error("Drive API error"));

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        userId: "user-1",
        driveFileId: "drive-1",
        driveConnectionId: "conn-1",
      },
    ] as never);
    vi.mocked(prisma.googleDriveConnection.findUnique).mockResolvedValue({
      id: "conn-1",
      userId: "user-1",
      encryptedAccessToken: "encrypted-token",
      encryptedRefreshToken: "encrypted-refresh",
      accessTokenExpiry: new Date(Date.now() + 3600000),
    } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["item-1"]);

    // Should still succeed - Drive delete is soft failure
    expect(result.success).toBe(true);
    expect(prisma.item.deleteMany).toHaveBeenCalled();
  });

  it("does not call batch delete when items have no Drive connection", async () => {
    const { batchDelete } = await import("@/lib/google-drive-client");

    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", driveFileId: null, driveConnectionId: null },
      { id: "2", userId: "user-1", driveFileId: null, driveConnectionId: null },
    ] as never);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 2 });

    const { deleteItems } = await import("@/lib/item-actions");
    const result = await deleteItems(["1", "2"]);

    expect(result.success).toBe(true);
    expect(batchDelete).not.toHaveBeenCalled();
  });
});
