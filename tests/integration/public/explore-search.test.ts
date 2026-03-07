import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getExploreItems } from "@/lib/public-auth";
import { prisma } from "@/lib/prisma";

describe("getExploreItems search", () => {
  let userId: string;

  beforeAll(async () => {
    // Clean up any leftover data from previous failed runs
    const existing = await prisma.user.findUnique({
      where: { email: "explore-search-test@test.com" },
    });
    if (existing) {
      await prisma.item.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const user = await prisma.user.create({
      data: {
        email: "explore-search-test@test.com",
        username: "exploresearchtest",
        name: "Explore Search Test",
        passwordHash: "hashed",
        isPublic: true,
      },
    });
    userId = user.id;

    // Use unique prefix to avoid cross-test bleed in shared DB
    await prisma.item.createMany({
      data: [
        {
          name: "xsrch_Breaking Bad",
          userId,
          isPublic: true,
          inheritVisibility: false,
          depth: 0,
          order: 0,
        },
        {
          name: "xsrch_Better Call Saul",
          userId,
          isPublic: true,
          inheritVisibility: false,
          depth: 0,
          order: 1,
        },
        {
          name: "xsrch_The Wire",
          userId,
          isPublic: true,
          inheritVisibility: false,
          depth: 0,
          order: 2,
        },
        {
          name: "xsrch_100% Match",
          userId,
          isPublic: true,
          inheritVisibility: false,
          depth: 0,
          order: 3,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.item.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  it("filters items by search query (case-insensitive)", async () => {
    const result = await getExploreItems({
      search: "xsrch_breaking",
      currentUserId: null,
    });
    expect(result.items.length).toBe(1);
    expect(result.items[0].name).toBe("xsrch_Breaking Bad");
  });

  it("returns empty for no matches", async () => {
    const result = await getExploreItems({
      search: "xsrch_nonexistent",
      currentUserId: null,
    });
    expect(result.items.length).toBe(0);
    expect(result.nextCursor).toBeNull();
  });

  it("escapes SQL wildcards in search terms", async () => {
    // "%" should not match everything — only our prefixed item
    const result = await getExploreItems({
      search: "xsrch_100%",
      currentUserId: null,
    });
    expect(result.items.length).toBe(1); // Only "xsrch_100% Match"
  });

  it("returns all items with scoped search", async () => {
    const result = await getExploreItems({
      search: "xsrch_",
      currentUserId: null,
    });
    expect(result.items.length).toBe(4);
  });
});
