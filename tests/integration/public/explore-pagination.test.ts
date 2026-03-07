import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getExploreItems } from "@/lib/public-auth";
import { prisma } from "@/lib/prisma";

describe("getExploreItems pagination", () => {
  let userId: string;

  beforeAll(async () => {
    // Clean up any leftover data from previous failed runs
    const existing = await prisma.user.findUnique({
      where: { email: "explore-pagination-test@test.com" },
    });
    if (existing) {
      await prisma.item.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: {
        email: "explore-pagination-test@test.com",
        username: "explorepagtest",
        name: "Explore Pagination Test",
        passwordHash: "hashed",
        isPublic: true,
      },
    });
    userId = user.id;

    for (let i = 0; i < 30; i++) {
      await prisma.item.create({
        data: {
          name: `Explore Item ${String(i).padStart(2, "0")}`,
          userId,
          isPublic: true,
          inheritVisibility: false,
          depth: 0,
          order: i,
          updatedAt: new Date(Date.now() - i * 60000),
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.item.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  // Use search to scope results to this test's items (avoids cross-test bleed)
  const searchScope = "Explore Item";

  it("returns first page with nextCursor", async () => {
    const result = await getExploreItems({
      search: searchScope,
      currentUserId: null,
    });
    expect(result.items.length).toBe(24);
    expect(result.nextCursor).not.toBeNull();
  });

  it("returns second page using cursor", async () => {
    const first = await getExploreItems({
      search: searchScope,
      currentUserId: null,
    });
    const second = await getExploreItems({
      search: searchScope,
      cursor: first.nextCursor,
      currentUserId: null,
    });
    expect(second.items.length).toBe(6);
    expect(second.nextCursor).toBeNull();
  });

  it("returns no duplicates across pages", async () => {
    const first = await getExploreItems({
      search: searchScope,
      currentUserId: null,
    });
    const second = await getExploreItems({
      search: searchScope,
      cursor: first.nextCursor,
      currentUserId: null,
    });
    const allIds = [...first.items, ...second.items].map((i) => i.id);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("handles tampered cursor gracefully", async () => {
    const result = await getExploreItems({
      search: searchScope,
      cursor: "not-a-valid-cursor",
      currentUserId: null,
    });
    // Should treat as no cursor (first page)
    expect(result.items.length).toBe(24);
  });
});
