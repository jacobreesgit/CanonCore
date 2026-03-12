import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    watchRecord: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { createWatchRecordIfNotRecent } from "@/lib/watch-record-utils";

const mockPrisma = prisma as unknown as {
  watchRecord: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createWatchRecordIfNotRecent", () => {
  it("creates a WatchRecord when no recent record exists", async () => {
    mockPrisma.watchRecord.findFirst.mockResolvedValue(null);
    mockPrisma.watchRecord.create.mockResolvedValue({ id: "wr-new" });

    const created = await createWatchRecordIfNotRecent(
      "item-1",
      "user-1",
      "AUTO"
    );

    expect(created).toBe(true);
    expect(mockPrisma.watchRecord.create).toHaveBeenCalledWith({
      data: { itemId: "item-1", userId: "user-1", source: "AUTO" },
    });
  });

  it("does NOT create a WatchRecord when a recent record exists", async () => {
    mockPrisma.watchRecord.findFirst.mockResolvedValue({
      id: "wr-existing",
      watchedAt: new Date(),
    });

    const created = await createWatchRecordIfNotRecent(
      "item-1",
      "user-1",
      "AUTO"
    );

    expect(created).toBe(false);
    expect(mockPrisma.watchRecord.create).not.toHaveBeenCalled();
  });

  it("passes the correct source parameter through to create", async () => {
    mockPrisma.watchRecord.findFirst.mockResolvedValue(null);
    mockPrisma.watchRecord.create.mockResolvedValue({ id: "wr-manual" });

    await createWatchRecordIfNotRecent("item-1", "user-1", "MANUAL");

    expect(mockPrisma.watchRecord.create).toHaveBeenCalledWith({
      data: { itemId: "item-1", userId: "user-1", source: "MANUAL" },
    });
  });

  it("uses watchedAt for the dedup window (gte filter in findFirst)", async () => {
    mockPrisma.watchRecord.findFirst.mockResolvedValue(null);
    mockPrisma.watchRecord.create.mockResolvedValue({ id: "wr-1" });

    const before = Date.now();
    await createWatchRecordIfNotRecent("item-1", "user-1", "AUTO");

    // Verify findFirst was called with the correct watchedAt gte filter
    const findFirstCall = mockPrisma.watchRecord.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.itemId).toBe("item-1");
    expect(findFirstCall.where.userId).toBe("user-1");
    expect(findFirstCall.where.watchedAt).toBeDefined();
    expect(findFirstCall.where.watchedAt.gte).toBeInstanceOf(Date);

    // The dedup cutoff should be approximately 5 minutes before now
    const dedupCutoff = findFirstCall.where.watchedAt.gte as Date;
    const fiveMinutesMs = 5 * 60 * 1000;
    const expectedCutoff = before - fiveMinutesMs;
    // Allow 1 second tolerance for test execution time
    expect(Math.abs(dedupCutoff.getTime() - expectedCutoff)).toBeLessThan(1000);

    // Verify it also uses orderBy watchedAt desc
    expect(findFirstCall.orderBy).toEqual({ watchedAt: "desc" });
  });
});
