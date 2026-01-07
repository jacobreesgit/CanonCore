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
} from "@/lib/item-actions";
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
  sftpPath: null,
  mimeType: null,
  size: null,
  checksum: null,
  syncStatus: "SYNCED" as const,
  lastSyncedAt: null,
  sftpModifiedAt: null,
  connectionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  // Include files array with fileType and isPrimary for fileCounts support
  files: overrides.artworkId
    ? [{ id: overrides.artworkId, fileType: "ARTWORK", isPrimary: true }]
    : [],
  connection: null,
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
          select: { id: true, fileType: true, isPrimary: true },
        },
        connection: {
          select: { name: true },
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
          select: { id: true, fileType: true, isPrimary: true },
        },
        connection: {
          select: { name: true },
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
          userId: "user-123",
          createdAt: new Date(),
          updatedAt: new Date(),
          sftpPath: null,
          sftpModifiedAt: null,
          connectionId: null,
          files: [],
          connection: null,
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
        userId: "user-123",
        createdAt: new Date(),
        updatedAt: new Date(),
        sftpPath: null,
        sftpModifiedAt: null,
        connectionId: null,
        files: [],
        connection: null,
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

  it("returns validation error for description over 200 chars", async () => {
    mockAuth.mockResolvedValue(mockSession("user-1", "test@example.com"));

    const result = await createItem(null, "Folder", "a".repeat(201));

    expect(result.error).toContain("200");
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
