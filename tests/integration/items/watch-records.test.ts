/**
 * Integration tests for watch record server actions.
 * Tests createWatchRecord, markAsWatched, markAsUnwatched,
 * and markAllWatched against real database.
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from "vitest";
import type { Session } from "next-auth";
import {
  createWatchRecord,
  markAsWatched,
  markAsUnwatched,
  markAllWatched,
  markAllUnwatched,
  getWatchStatus,
} from "@/lib/watch-actions";
import { prisma } from "@/lib/prisma";
import "../setup";

// Mock auth to return our test user
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock revalidatePath (not available outside Next.js runtime)
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/lib/auth";

// Cast to bypass complex next-auth types
const mockAuth = auth as unknown as ReturnType<
  typeof vi.fn<() => Promise<Session | null>>
>;

// Use unique ID per test run to avoid conflicts
const TEST_USER_ID = `test-watch-${Date.now()}-${Math.random().toString(36).substring(7)}`;
const TEST_USER_EMAIL = `watch-${Date.now()}@test.example.com`;

// Create test user once
beforeAll(async () => {
  await prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      passwordHash: "hashed",
    },
  });
});

// Clean up after all tests
afterAll(async () => {
  await prisma.watchRecord.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.itemFile.deleteMany({
    where: { item: { userId: TEST_USER_ID } },
  });
  await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
});

describe("watch records integration", () => {
  beforeEach(async () => {
    // Clean watch records and items between tests
    await prisma.watchRecord.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.itemFile.deleteMany({
      where: { item: { userId: TEST_USER_ID } },
    });
    await prisma.item.deleteMany({ where: { userId: TEST_USER_ID } });

    mockAuth.mockResolvedValue({
      user: { id: TEST_USER_ID, email: TEST_USER_EMAIL },
      expires: new Date().toISOString(),
    });
  });

  it("creates a WatchRecord in the database", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const result = await createWatchRecord(item.id, "MANUAL");
    expect(result.success).toBe(true);

    const records = await prisma.watchRecord.findMany({
      where: { itemId: item.id, userId: TEST_USER_ID },
    });
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe("MANUAL");
  });

  it("deduplicates within 5-minute window", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    // Create first record
    await createWatchRecord(item.id, "AUTO");

    // Try creating second record immediately — should be deduped
    await createWatchRecord(item.id, "AUTO");

    const records = await prisma.watchRecord.findMany({
      where: { itemId: item.id, userId: TEST_USER_ID },
    });
    expect(records).toHaveLength(1);
  });

  it("allows new record after dedup window expires", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    // Create first record with backdated watchedAt (6 minutes ago)
    await prisma.watchRecord.create({
      data: {
        itemId: item.id,
        userId: TEST_USER_ID,
        source: "AUTO",
        watchedAt: new Date(Date.now() - 6 * 60 * 1000),
      },
    });

    // Create second record — should succeed since first is outside window
    const result = await createWatchRecord(item.id, "AUTO");
    expect(result.success).toBe(true);

    const records = await prisma.watchRecord.findMany({
      where: { itemId: item.id, userId: TEST_USER_ID },
    });
    expect(records).toHaveLength(2);
  });

  it("markAsWatched creates MANUAL WatchRecord", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const result = await markAsWatched(item.id);
    expect(result.success).toBe(true);

    const records = await prisma.watchRecord.findMany({
      where: { itemId: item.id, userId: TEST_USER_ID },
    });
    expect(records).toHaveLength(1);
    expect(records[0].source).toBe("MANUAL");
  });

  it("markAsUnwatched deletes only the most recent record", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    // Create two records (backdating the first to avoid dedup)
    const older = await prisma.watchRecord.create({
      data: {
        itemId: item.id,
        userId: TEST_USER_ID,
        source: "AUTO",
        watchedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    await prisma.watchRecord.create({
      data: {
        itemId: item.id,
        userId: TEST_USER_ID,
        source: "MANUAL",
        watchedAt: new Date(), // now
      },
    });

    const result = await markAsUnwatched(item.id);
    expect(result.success).toBe(true);

    // Only the older record should remain
    const remaining = await prisma.watchRecord.findMany({
      where: { itemId: item.id, userId: TEST_USER_ID },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(older.id);
  });

  it("getWatchStatus returns correct data", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Movie",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    // Initially unwatched
    const unwatchedResult = await getWatchStatus(item.id);
    expect(unwatchedResult.success).toBe(true);
    if (unwatchedResult.success) {
      expect(unwatchedResult.data).toEqual({
        isWatched: false,
        playCount: 0,
      });
    }

    // Create watch record
    await prisma.watchRecord.create({
      data: {
        itemId: item.id,
        userId: TEST_USER_ID,
        source: "MANUAL",
      },
    });

    const watchedResult = await getWatchStatus(item.id);
    expect(watchedResult.success).toBe(true);
    if (watchedResult.success) {
      expect(watchedResult.data).toEqual({
        isWatched: true,
        playCount: 1,
      });
    }
  });

  it("markAllWatched creates records for all unwatched descendants with media", async () => {
    // Create parent (container, no media) with 3 episodes (each has primary media)
    const parent = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const child1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    const child2 = await prisma.item.create({
      data: {
        name: "Episode 2",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    const child3 = await prisma.item.create({
      data: {
        name: "Episode 3",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 2,
        depth: 1,
      },
    });

    // Add primary media files to each episode (required by markAllWatched query)
    await prisma.itemFile.createMany({
      data: [child1, child2, child3].map((c) => ({
        itemId: c.id,
        filename: `${c.name}.mp4`,
        mimeType: "video/mp4",
        fileType: "MEDIA" as const,
        isPrimary: true,
      })),
    });

    // Mark child1 as already watched
    await prisma.watchRecord.create({
      data: {
        itemId: child1.id,
        userId: TEST_USER_ID,
        source: "AUTO",
      },
    });

    const result = await markAllWatched(parent.id);

    expect(result.success).toBe(true);

    // Should have records for child2 + child3 (2 new) + child1 (1 existing) = 3 total
    // Parent has no media, so no record for it
    const allRecords = await prisma.watchRecord.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(allRecords).toHaveLength(3);

    // Verify the newly created records are MANUAL source
    const manualRecords = allRecords.filter((r) => r.source === "MANUAL");
    expect(manualRecords).toHaveLength(2); // child2, child3

    // Verify child1's original AUTO record was preserved
    const child1Records = allRecords.filter((r) => r.itemId === child1.id);
    expect(child1Records).toHaveLength(1);
    expect(child1Records[0].source).toBe("AUTO");
  });

  it("markAllWatched handles deeply nested hierarchies", async () => {
    // Create 3-level deep hierarchy: Show > Season > Episode
    // Only episodes have primary media (containers don't)
    const show = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const season = await prisma.item.create({
      data: {
        name: "Season 1",
        userId: TEST_USER_ID,
        parentId: show.id,
        order: 0,
        depth: 1,
      },
    });

    const episode1 = await prisma.item.create({
      data: {
        name: "S01E01",
        userId: TEST_USER_ID,
        parentId: season.id,
        order: 0,
        depth: 2,
      },
    });

    const episode2 = await prisma.item.create({
      data: {
        name: "S01E02",
        userId: TEST_USER_ID,
        parentId: season.id,
        order: 1,
        depth: 2,
      },
    });

    // Add primary media files to episodes only
    await prisma.itemFile.createMany({
      data: [episode1, episode2].map((ep) => ({
        itemId: ep.id,
        filename: `${ep.name}.mp4`,
        mimeType: "video/mp4",
        fileType: "MEDIA" as const,
        isPrimary: true,
      })),
    });

    const result = await markAllWatched(show.id);

    expect(result.success).toBe(true);

    // Only episodes with media get records (not show or season)
    const records = await prisma.watchRecord.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(records).toHaveLength(2);

    // Verify episode records
    const recordItemIds = new Set(records.map((r) => r.itemId));
    expect(recordItemIds.has(episode1.id)).toBe(true);
    expect(recordItemIds.has(episode2.id)).toBe(true);
  });

  it("markAllUnwatched removes all WatchRecords for descendants", async () => {
    // Create parent with 2 children, all watched
    const parent = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const child1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    const child2 = await prisma.item.create({
      data: {
        name: "Episode 2",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    // Mark all as watched
    await prisma.watchRecord.createMany({
      data: [
        { itemId: parent.id, userId: TEST_USER_ID, source: "MANUAL" },
        { itemId: child1.id, userId: TEST_USER_ID, source: "AUTO" },
        { itemId: child2.id, userId: TEST_USER_ID, source: "MANUAL" },
      ],
    });

    const result = await markAllUnwatched(parent.id);
    expect(result.success).toBe(true);

    // All records should be deleted
    const remaining = await prisma.watchRecord.findMany({
      where: { userId: TEST_USER_ID },
    });
    expect(remaining).toHaveLength(0);
  });

  it("markAllWatched is idempotent - second call creates no new records", async () => {
    // Setup: parent with child items that have media files
    const parent = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: TEST_USER_ID,
        order: 0,
        depth: 0,
      },
    });

    const child1 = await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 0,
        depth: 1,
      },
    });

    const child2 = await prisma.item.create({
      data: {
        name: "Episode 2",
        userId: TEST_USER_ID,
        parentId: parent.id,
        order: 1,
        depth: 1,
      },
    });

    // Add primary media files
    await prisma.itemFile.createMany({
      data: [child1, child2].map((c) => ({
        itemId: c.id,
        filename: `${c.name}.mp4`,
        mimeType: "video/mp4",
        fileType: "MEDIA" as const,
        isPrimary: true,
      })),
    });

    // First call — should create records for both children
    const firstResult = await markAllWatched(parent.id);
    expect(firstResult.success).toBe(true);

    const firstCount = await prisma.watchRecord.count({
      where: { userId: TEST_USER_ID },
    });
    expect(firstCount).toBe(2);

    // Second call — should create no new records (all already watched)
    const secondResult = await markAllWatched(parent.id);
    expect(secondResult.success).toBe(true);

    const secondCount = await prisma.watchRecord.count({
      where: { userId: TEST_USER_ID },
    });
    expect(secondCount).toBe(firstCount);
  });
});
