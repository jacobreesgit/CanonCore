import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    watchRecord: {
      findFirst: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    item: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/watch-record-utils", () => ({
  createWatchRecordIfNotRecent: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWatchRecordIfNotRecent } from "@/lib/watch-record-utils";
import {
  createWatchRecord,
  markAsWatched,
  markAsUnwatched,
  getWatchStatus,
  markAllWatched,
  markAllUnwatched,
} from "@/lib/watch-actions";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockCreateWatchRecordIfNotRecent =
  createWatchRecordIfNotRecent as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as unknown as {
  watchRecord: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  item: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  $queryRaw: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
});

describe("createWatchRecord", () => {
  it("creates a record when none exists within dedup window", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
    });
    mockCreateWatchRecordIfNotRecent.mockResolvedValue(true);

    const result = await createWatchRecord("item-1", "AUTO");
    expect(result.success).toBe(true);
    expect(mockCreateWatchRecordIfNotRecent).toHaveBeenCalledWith(
      "item-1",
      "user-1",
      "AUTO"
    );
  });

  it("skips creation when record exists within 5-minute window", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
    });
    mockCreateWatchRecordIfNotRecent.mockResolvedValue(false);

    const result = await createWatchRecord("item-1", "AUTO");
    expect(result.success).toBe(true);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await createWatchRecord("item-1", "AUTO");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockPrisma.item.findUnique.mockResolvedValue(null);
    const result = await createWatchRecord("item-1", "AUTO");
    expect(result).toEqual({ success: false, error: "Item not found" });
  });

  it("returns error when user does not own item", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "other-user",
    });
    const result = await createWatchRecord("item-1", "AUTO");
    expect(result).toEqual({ success: false, error: "Access denied" });
  });
});

describe("markAsWatched", () => {
  it("creates a MANUAL watch record", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
    });
    mockCreateWatchRecordIfNotRecent.mockResolvedValue(true);

    const result = await markAsWatched("item-1");
    expect(result.success).toBe(true);
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await markAsWatched("item-1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });
});

describe("markAsUnwatched", () => {
  it("deletes the most recent watch record", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
    });
    mockPrisma.watchRecord.findFirst.mockResolvedValue({ id: "wr-1" });
    mockPrisma.watchRecord.delete.mockResolvedValue({ id: "wr-1" });

    const result = await markAsUnwatched("item-1");
    expect(result.success).toBe(true);
    expect(mockPrisma.watchRecord.delete).toHaveBeenCalledWith({
      where: { id: "wr-1" },
    });
  });

  it("returns error when no watch record exists", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
    });
    mockPrisma.watchRecord.findFirst.mockResolvedValue(null);

    const result = await markAsUnwatched("item-1");
    expect(result).toEqual({
      success: false,
      error: "No watch record to remove",
    });
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await markAsUnwatched("item-1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockPrisma.item.findUnique.mockResolvedValue(null);
    const result = await markAsUnwatched("item-1");
    expect(result).toEqual({ success: false, error: "Item not found" });
  });

  it("returns error when user does not own item", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "item-1",
      userId: "other-user",
    });
    const result = await markAsUnwatched("item-1");
    expect(result).toEqual({ success: false, error: "Access denied" });
  });
});

describe("getWatchStatus", () => {
  it("returns isWatched=true with playCount when records exist", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({ userId: "user-1" });
    mockPrisma.watchRecord.count.mockResolvedValue(2);

    const result = await getWatchStatus("item-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        isWatched: true,
        playCount: 2,
      });
    }
  });

  it("returns isWatched=false when no records exist", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({ userId: "user-1" });
    mockPrisma.watchRecord.count.mockResolvedValue(0);

    const result = await getWatchStatus("item-1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        isWatched: false,
        playCount: 0,
      });
    }
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getWatchStatus("item-1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });
});

describe("markAllWatched", () => {
  it("creates WatchRecords for all unwatched descendants", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "parent-1",
      userId: "user-1",
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: "child-1" },
      { id: "child-2" },
    ]);
    mockPrisma.watchRecord.createMany.mockResolvedValue({ count: 2 });

    const result = await markAllWatched("parent-1");
    expect(result.success).toBe(true);
    expect(mockPrisma.watchRecord.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ itemId: "child-1", source: "MANUAL" }),
        expect.objectContaining({ itemId: "child-2", source: "MANUAL" }),
      ]),
    });
  });

  it("skips createMany when no unwatched descendants exist", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "parent-1",
      userId: "user-1",
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await markAllWatched("parent-1");
    expect(result.success).toBe(true);
    expect(mockPrisma.watchRecord.createMany).not.toHaveBeenCalled();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await markAllWatched("parent-1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockPrisma.item.findUnique.mockResolvedValue(null);
    const result = await markAllWatched("parent-1");
    expect(result).toEqual({ success: false, error: "Item not found" });
  });

  it("returns error when user does not own item", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "parent-1",
      userId: "other-user",
    });
    const result = await markAllWatched("parent-1");
    expect(result).toEqual({ success: false, error: "Access denied" });
  });
});

describe("markAllUnwatched", () => {
  it("deletes WatchRecords for all descendants", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "parent-1",
      userId: "user-1",
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: "parent-1" },
      { id: "child-1" },
      { id: "child-2" },
    ]);
    mockPrisma.watchRecord.deleteMany.mockResolvedValue({ count: 3 });

    const result = await markAllUnwatched("parent-1");
    expect(result.success).toBe(true);
    expect(mockPrisma.watchRecord.deleteMany).toHaveBeenCalledWith({
      where: {
        itemId: { in: ["parent-1", "child-1", "child-2"] },
        userId: "user-1",
      },
    });
  });

  it("skips deleteMany when no descendants exist", async () => {
    mockPrisma.item.findUnique.mockResolvedValue({
      id: "parent-1",
      userId: "user-1",
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await markAllUnwatched("parent-1");
    expect(result.success).toBe(true);
    expect(mockPrisma.watchRecord.deleteMany).not.toHaveBeenCalled();
  });

  it("returns error when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await markAllUnwatched("parent-1");
    expect(result).toEqual({ success: false, error: "Unauthorized" });
  });

  it("returns error when item not found", async () => {
    mockPrisma.item.findUnique.mockResolvedValue(null);
    const result = await markAllUnwatched("parent-1");
    expect(result).toEqual({ success: false, error: "Item not found" });
  });
});
