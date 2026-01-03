/**
 * Unit tests for item actions.
 * Tests all CRUD operations with mocked Prisma and auth.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Session } from "next-auth";
import {
  getItems,
  getItem,
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

/** Helper to create a mock item with all required SFTP fields */
const mockItem = (overrides: {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
  depth: number;
  userId: string;
  artworkId?: string | null;
}) => ({
  ...overrides,
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
  // Include files array for artwork thumbnail support
  files: overrides.artworkId ? [{ id: overrides.artworkId }] : [],
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
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", parentId: null },
      orderBy: { order: "asc" },
      include: {
        files: {
          where: { fileType: "ARTWORK" },
          take: 1,
          orderBy: { filename: "asc" },
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
    expect(prisma.item.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", parentId: "parent-1" },
      orderBy: { order: "asc" },
      include: {
        files: {
          where: { fileType: "ARTWORK" },
          take: 1,
          orderBy: { filename: "asc" },
          select: { id: true },
        },
      },
    });
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
