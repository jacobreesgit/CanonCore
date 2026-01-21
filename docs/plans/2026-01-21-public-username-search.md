# Public Search (Users & Items) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the ability to search for public usernames AND public items in the Spotlight Search dialog, allowing users to discover public profiles and collections directly from search.

**Architecture:** Extend the existing SpotlightSearch component to fetch and display three categories: user's own items (current), public users, and public items from other users. Add `searchPublicUsers()` and `searchPublicItems()` server actions in `lib/public-auth.ts` wrapped with `React.cache()` for per-request deduplication. Display results in grouped sections with distinct visual treatment and independent loading states.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma, cmdk (existing), shadcn/ui (existing)

---

## Overview

The spotlight search currently searches only the user's own items. This feature adds:

1. **Public user search** - Find public profiles by username or name
2. **Public item search** - Find explicitly public items from other users

### Visibility Logic for Public Items

**CRITICAL**: Items have two visibility fields that work together:

| `isPublic` | `inheritVisibility` | Behavior                                                     |
| ---------- | ------------------- | ------------------------------------------------------------ |
| `true`     | `false`             | **Explicitly public** - appears in Explore and global search |
| `false`    | `false`             | **Private** - only owner can see                             |
| `false`    | `true`              | **Inheriting** - visibility determined by parent chain       |
| `true`     | `true`              | Invalid combo (inheritVisibility takes precedence)           |

**For global search, we only show explicitly public items** (`isPublic: true` AND `inheritVisibility: false`):

- This matches the Explore page behavior
- Inheriting items are discoverable only through navigation within their parent
- Prevents confusing results where an item appears public but its parent is private

### Key Design Decisions

1. **Three result sections**: "Your Items", "Public Collections", "People"
2. **Parallel fetching**: Fetch all three in parallel with SWR-style caching
3. **Independent loading states**: Each section shows skeleton/content independently
4. **Cache with TTL**: Module-level cache invalidates after 60 seconds
5. **Explicit public only**: Public items must have `isPublic: true` AND `inheritVisibility: false`
6. **Owner attribution**: Public items show owner's username for context
7. **Rate limiting**: Add `userSearch` and `publicItemSearch` limiters (60/min each)
8. **Exclude self**: Don't show user's own public items in "Public Collections"
9. **Minimal serialization**: Only serialize fields needed for UI display (no unused dates)
10. **Result limits**: Users limited to 50 (profiles change less), items to 100 (more variety)

---

## Task 1: Add SearchableUser and SearchablePublicItem Types

**Files:**

- Modify: `lib/types.ts:239-249` (after SearchableItem)

**Step 1: Add new interfaces**

Add after `SearchableItem` interface (around line 249):

```typescript
/**
 * Public user data for spotlight search display.
 * Includes username and name for search matching.
 * NOTE: Only includes fields needed for UI - no unnecessary metadata.
 */
export interface SearchableUser {
  /** User ID */
  id: string;
  /** Public username (URL slug) */
  username: string;
  /** Display name (may be null) */
  name: string | null;
}

/**
 * Public item data for spotlight search display.
 * Only includes explicitly public items (isPublic=true, inheritVisibility=false).
 * Includes owner info for attribution.
 * NOTE: Only includes fields needed for UI - no unnecessary metadata.
 */
export interface SearchablePublicItem {
  /** Item ID */
  id: string;
  /** Item name */
  name: string;
  /** Item description */
  description: string | null;
  /** First artwork file ID for thumbnail */
  artworkId: string | null;
  /** Owner's username for attribution and navigation */
  ownerUsername: string;
  /** Owner's display name */
  ownerName: string | null;
}
```

> **Note:** `createdAt` and `updatedAt` intentionally omitted per `server-serialization` rule - these are used for server-side sorting only and should not be serialized to client.

**Step 2: Verify types compile**

Run: `pnpm run type-check`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "$(cat <<'EOF'
feat(types): add SearchableUser and SearchablePublicItem types

Adds interfaces for public search results in spotlight dialog:
- SearchableUser for public profile search
- SearchablePublicItem for public item search with owner attribution

Only includes fields needed for UI display (no unnecessary metadata).
EOF
)"
```

---

## Task 2: Add Rate Limiters for Public Search

**Files:**

- Modify: `lib/rate-limit.ts:92-112` (after publicProfile limiter)

**Step 1: Add rate limiters**

Add after `publicProfile` limiter (around line 107):

```typescript
  userSearch: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:user:search",
  }),
  publicItemSearch: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "ratelimit:public:item:search",
  }),
```

**Step 2: Verify types compile**

Run: `pnpm run type-check`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/rate-limit.ts
git commit -m "$(cat <<'EOF'
feat(rate-limit): add public search rate limiters

60 requests/minute for both userSearch and publicItemSearch.
EOF
)"
```

---

## Task 3: Add searchPublicUsers Server Action

**Files:**

- Modify: `lib/public-auth.ts` (add at end of file)
- Test: `tests/unit/lib/search-public-users.test.ts`

**Step 1: Write the failing test**

Create test file `tests/unit/lib/search-public-users.test.ts`:

```typescript
/**
 * Unit tests for searchPublicUsers server action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../setup";

// Mock dependencies - include all Prisma methods that might be used
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

import { searchPublicUsers } from "@/lib/public-auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

describe("searchPublicUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(checkRateLimit).mockResolvedValue(null);
  });

  it("returns public users with username", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: "user-2",
        username: "johndoe",
        name: "John Doe",
      },
    ]);

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].username).toBe("johndoe");
    expect(result.data?.[0].name).toBe("John Doe");
  });

  it("excludes current user from results", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await searchPublicUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: "user-1" },
        }),
      })
    );
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await searchPublicUsers();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Too many attempts",
    });

    const result = await searchPublicUsers();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Too many attempts");
  });

  it("limits results to 50 users", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await searchPublicUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      })
    );
  });

  it("only returns users with isPublic true and username set", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);

    await searchPublicUsers();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          username: { not: null },
        }),
      })
    );
  });

  it("returns error when Prisma throws", async () => {
    vi.mocked(prisma.user.findMany).mockRejectedValue(new Error("DB error"));

    const result = await searchPublicUsers();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Failed to search users");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/lib/search-public-users.test.ts`
Expected: FAIL with "searchPublicUsers is not exported"

**Step 3: Write the server action**

Add to end of `lib/public-auth.ts`:

```typescript
import { cache } from "react";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import type {
  ItemResult,
  SearchableUser,
  SearchablePublicItem,
} from "@/lib/types";

/**
 * Searches for public users for spotlight search.
 * Returns users with public profiles and usernames set.
 * Excludes the current user from results.
 * Wrapped with React.cache() for per-request deduplication.
 *
 * @returns Array of searchable public users
 */
export const searchPublicUsers = cache(
  async (): Promise<ItemResult<SearchableUser[]>> => {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("userSearch"),
    ]);

    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    if (rateLimitResult) {
      return rateLimitResult;
    }

    try {
      const users = await prisma.user.findMany({
        where: {
          isPublic: true,
          username: { not: null },
          id: { not: session.user.id },
        },
        select: {
          id: true,
          username: true,
          name: true,
          // NOTE: createdAt intentionally NOT selected - not needed for UI
        },
        orderBy: { createdAt: "desc" },
        take: 50, // Users: 50 limit (profiles change less frequently)
      });

      const searchableUsers: SearchableUser[] = users
        .filter(
          (u): u is typeof u & { username: string } => u.username !== null
        )
        .map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
        }));

      return { success: true, data: searchableUsers };
    } catch {
      return { error: "Failed to search users" };
    }
  }
);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/lib/search-public-users.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/public-auth.ts tests/unit/lib/search-public-users.test.ts
git commit -m "$(cat <<'EOF'
feat(public-auth): add searchPublicUsers server action

Server action fetches public users for spotlight search.
- Wrapped with React.cache() for per-request deduplication
- Excludes current user from results
- Rate limited to 60/min
- Returns max 50 users
- Only serializes fields needed for UI (no createdAt)
EOF
)"
```

---

## Task 4: Add searchPublicItems Server Action

**Files:**

- Modify: `lib/public-auth.ts`
- Test: `tests/unit/lib/search-public-items.test.ts`

**Step 1: Write the failing test**

Create test file `tests/unit/lib/search-public-items.test.ts`:

```typescript
/**
 * Unit tests for searchPublicItems server action.
 * Tests visibility logic: only explicitly public items appear in search.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import "../setup";

// Mock dependencies - include all Prisma methods that might be used
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));

import { searchPublicItems } from "@/lib/public-auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { auth } from "@/lib/auth";

describe("searchPublicItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(checkRateLimit).mockResolvedValue(null);
  });

  it("returns explicitly public items from other users", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        name: "Star Wars Collection",
        description: "Original trilogy",
        files: [{ id: "artwork-1" }],
        user: { username: "johndoe", name: "John Doe" },
      },
    ]);

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0].name).toBe("Star Wars Collection");
    expect(result.data?.[0].ownerUsername).toBe("johndoe");
    expect(result.data?.[0].artworkId).toBe("artwork-1");
  });

  it("excludes current user's items", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: "user-1" },
        }),
      })
    );
  });

  it("only queries explicitly public items (isPublic=true, inheritVisibility=false)", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPublic: true,
          inheritVisibility: false,
        }),
      })
    );
  });

  it("only includes items from public users with usernames", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: {
            isPublic: true,
            username: { not: null },
          },
        }),
      })
    );
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await searchPublicItems();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Unauthorized");
  });

  it("returns error when rate limited", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({
      error: "Too many attempts",
    });

    const result = await searchPublicItems();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Too many attempts");
  });

  it("limits results to 100 items", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([]);

    await searchPublicItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      })
    );
  });

  it("returns null artworkId when no artwork files", async () => {
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "item-1",
        name: "No Artwork Item",
        description: null,
        files: [],
        user: { username: "johndoe", name: "John Doe" },
      },
    ]);

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    expect(result.data?.[0].artworkId).toBeNull();
  });

  it("returns error when Prisma throws", async () => {
    vi.mocked(prisma.item.findMany).mockRejectedValue(new Error("DB error"));

    const result = await searchPublicItems();

    expect(result.success).toBeUndefined();
    expect(result.error).toBe("Failed to search public items");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/lib/search-public-items.test.ts`
Expected: FAIL with "searchPublicItems is not exported"

**Step 3: Write the server action**

Add to `lib/public-auth.ts`:

```typescript
/**
 * Searches for explicitly public items for spotlight search.
 * Only returns items where isPublic=true AND inheritVisibility=false.
 * Items with inheritVisibility=true are NOT included (discoverable only via navigation).
 * Excludes the current user's items.
 * Wrapped with React.cache() for per-request deduplication.
 *
 * @returns Array of searchable public items with owner info
 */
export const searchPublicItems = cache(
  async (): Promise<ItemResult<SearchablePublicItem[]>> => {
    const [session, rateLimitResult] = await Promise.all([
      auth(),
      checkRateLimit("publicItemSearch"),
    ]);

    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    if (rateLimitResult) {
      return rateLimitResult;
    }

    try {
      const items = await prisma.item.findMany({
        where: {
          // CRITICAL: Only explicitly public items
          // Items with inheritVisibility=true are NOT searchable
          isPublic: true,
          inheritVisibility: false,
          // Exclude current user's items
          userId: { not: session.user.id },
          // Owner must be public with username
          user: {
            isPublic: true,
            username: { not: null },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          // NOTE: updatedAt intentionally NOT selected - not needed for UI
          files: {
            where: { fileType: "ARTWORK" },
            select: { id: true },
            take: 1,
            orderBy: { isPrimary: "desc" },
          },
          user: {
            select: {
              username: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100, // Items: 100 limit (more variety in public collections)
      });

      const searchableItems: SearchablePublicItem[] = items
        .filter((item) => item.user.username !== null)
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          artworkId: item.files[0]?.id ?? null,
          ownerUsername: item.user.username!,
          ownerName: item.user.name,
        }));

      return { success: true, data: searchableItems };
    } catch {
      return { error: "Failed to search public items" };
    }
  }
);
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/lib/search-public-items.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/public-auth.ts tests/unit/lib/search-public-items.test.ts
git commit -m "$(cat <<'EOF'
feat(public-auth): add searchPublicItems server action

Server action fetches explicitly public items for spotlight search.
- Wrapped with React.cache() for per-request deduplication
- Only items with isPublic=true AND inheritVisibility=false
- Inheriting items are NOT searchable (matches Explore behavior)
- Excludes current user's items
- Includes owner attribution
- Rate limited to 60/min, max 100 results
- Only serializes fields needed for UI (no updatedAt)
EOF
)"
```

---

## Task 5: Add Integration Tests for Public Search

**Files:**

- Create: `tests/integration/public/search-public.test.ts`

**Step 1: Write the integration tests**

```typescript
/**
 * Integration tests for public search server actions.
 * Tests visibility logic with real database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { searchPublicUsers, searchPublicItems } from "@/lib/public-auth";
import "../setup";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue("127.0.0.1"),
  }),
}));

vi.stubEnv("BYPASS_RATE_LIMIT", "true");

let currentTestUserId: string | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        currentTestUserId ? { user: { id: currentTestUserId } } : null
      )
    ),
}));

async function createTestUser(
  suffix: string,
  options: { isPublic?: boolean; username?: string | null } = {}
) {
  const email = `search-${Date.now()}-${suffix}@test.example.com`;
  const passwordHash = await hash("Password1", 10);

  return prisma.user.create({
    data: {
      email,
      name: `Test User ${suffix}`,
      passwordHash,
      isPublic: options.isPublic ?? false,
      username: options.username ?? null,
    },
  });
}

async function createTestItem(
  userId: string,
  name: string,
  options: { isPublic?: boolean; inheritVisibility?: boolean } = {}
) {
  return prisma.item.create({
    data: {
      userId,
      name,
      isPublic: options.isPublic ?? false,
      inheritVisibility: options.inheritVisibility ?? false,
      order: 0,
      depth: 0,
    },
  });
}

async function cleanupUser(userId: string) {
  await prisma.item.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

describe("searchPublicUsers Integration", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupUser(id);
    }
    createdUserIds.length = 0;
    currentTestUserId = null;
  });

  it("returns public users with usernames", async () => {
    const searcher = await createTestUser("searcher");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public", {
      isPublic: true,
      username: `public_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    const found = result.data?.find((u) => u.id === publicUser.id);
    expect(found).toBeDefined();
    expect(found?.username).toBe(publicUser.username);
  });

  it("excludes current user from results", async () => {
    const searcher = await createTestUser("self-searcher", {
      isPublic: true,
      username: `self_${Date.now()}`,
    });
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const result = await searchPublicUsers();

    expect(result.success).toBe(true);
    expect(result.data?.find((u) => u.id === searcher.id)).toBeUndefined();
  });
});

describe("searchPublicItems Integration", () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await cleanupUser(id);
    }
    createdUserIds.length = 0;
    currentTestUserId = null;
  });

  it("returns explicitly public items", async () => {
    const searcher = await createTestUser("searcher");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public-owner", {
      isPublic: true,
      username: `owner_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    const publicItem = await createTestItem(
      publicUser.id,
      "Explicit Public Item",
      {
        isPublic: true,
        inheritVisibility: false,
      }
    );

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    const found = result.data?.find((i) => i.id === publicItem.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe("Explicit Public Item");
    expect(found?.ownerUsername).toBe(publicUser.username);
  });

  it("excludes items with inheritVisibility=true", async () => {
    const searcher = await createTestUser("searcher2");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public-owner2", {
      isPublic: true,
      username: `owner2_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    // Create inheriting item - should NOT appear in search
    const inheritingItem = await createTestItem(
      publicUser.id,
      "Inheriting Item",
      {
        isPublic: false,
        inheritVisibility: true,
      }
    );

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    expect(
      result.data?.find((i) => i.id === inheritingItem.id)
    ).toBeUndefined();
  });

  it("excludes private items", async () => {
    const searcher = await createTestUser("searcher3");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const publicUser = await createTestUser("public-owner3", {
      isPublic: true,
      username: `owner3_${Date.now()}`,
    });
    createdUserIds.push(publicUser.id);

    const privateItem = await createTestItem(publicUser.id, "Private Item", {
      isPublic: false,
      inheritVisibility: false,
    });

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    expect(result.data?.find((i) => i.id === privateItem.id)).toBeUndefined();
  });

  it("excludes current user's public items", async () => {
    const searcher = await createTestUser("searcher4", {
      isPublic: true,
      username: `searcher4_${Date.now()}`,
    });
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const ownItem = await createTestItem(searcher.id, "Own Public Item", {
      isPublic: true,
      inheritVisibility: false,
    });

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    expect(result.data?.find((i) => i.id === ownItem.id)).toBeUndefined();
  });

  it("excludes items from private users", async () => {
    const searcher = await createTestUser("searcher5");
    createdUserIds.push(searcher.id);
    currentTestUserId = searcher.id;

    const privateUser = await createTestUser("private-owner", {
      isPublic: false,
      username: `private_${Date.now()}`,
    });
    createdUserIds.push(privateUser.id);

    const itemFromPrivateUser = await createTestItem(
      privateUser.id,
      "Item From Private User",
      {
        isPublic: true,
        inheritVisibility: false,
      }
    );

    const result = await searchPublicItems();

    expect(result.success).toBe(true);
    expect(
      result.data?.find((i) => i.id === itemFromPrivateUser.id)
    ).toBeUndefined();
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm run test:integration tests/integration/public/search-public.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/public/search-public.test.ts
git commit -m "$(cat <<'EOF'
test(integration): add public search integration tests

Tests with real database:
- Public user search returns users with usernames
- Public item search only returns explicit public items
- Inheriting items are excluded from search
- Current user's items are excluded
- Items from private users are excluded
EOF
)"
```

---

## Task 6: Create UserThumbnail Component

**Files:**

- Create: `components/search/user-thumbnail.tsx`
- Test: `tests/unit/components/search/user-thumbnail.test.tsx`

**Step 1: Write the failing test**

```typescript
/**
 * Unit tests for UserThumbnail component.
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { UserThumbnail } from "@/components/search/user-thumbnail";

describe("UserThumbnail", () => {
  it("shows initials when name is provided", () => {
    render(<UserThumbnail userId="user-123" name="John Doe" />);

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("shows first letter when name is single word", () => {
    render(<UserThumbnail userId="user-123" name="Alice" />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows user icon when name is null", () => {
    render(<UserThumbnail userId="user-123" name={null} />);

    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it("handles empty string name gracefully", () => {
    render(<UserThumbnail userId="user-123" name="" />);

    // Should show icon fallback for empty string
    expect(document.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/search/user-thumbnail.test.tsx`
Expected: FAIL with module not found

**Step 3: Write the component**

Create `components/search/user-thumbnail.tsx`:

```typescript
/**
 * User thumbnail component for spotlight search results.
 * Shows initials derived from name, or icon fallback.
 * Memoized to prevent unnecessary re-renders during search filtering.
 */

"use client";

import { memo } from "react";
import { User } from "lucide-react";

interface UserThumbnailProps {
  userId: string;
  name: string | null;
}

/**
 * Gets initials from a name (up to 2 characters).
 */
function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return words[0][0].toUpperCase();
}

/**
 * User avatar thumbnail with initials or icon fallback.
 * Memoized per react-best-practices rerender-memo rule.
 */
export const UserThumbnail = memo(function UserThumbnail({
  name,
}: UserThumbnailProps) {
  const initials = name ? getInitials(name) : "";

  return (
    <div className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
      {initials || <User aria-hidden="true" className="size-4" />}
    </div>
  );
});
```

> **Note:** Removed `hasImage` prop and avatar image loading. Per security review, exposing whether users have uploaded avatars is unnecessary metadata leakage. Initials provide sufficient visual distinction.

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/components/search/user-thumbnail.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/search/user-thumbnail.tsx tests/unit/components/search/user-thumbnail.test.tsx
git commit -m "$(cat <<'EOF'
feat(components): add UserThumbnail for spotlight search

Shows initials derived from name with icon fallback.
- Memoized to prevent re-renders during search filtering
- No avatar image (reduces metadata exposure per security review)
EOF
)"
```

---

## Task 7: Update SpotlightSearch Component

**Files:**

- Modify: `components/search/spotlight-search.tsx`
- Update: `tests/unit/components/search/spotlight-search.test.tsx`

**Step 1: Write the failing tests**

Add to `tests/unit/components/search/spotlight-search.test.tsx`:

```typescript
// Add mocks at top
vi.mock("@/lib/public-auth", () => ({
  searchPublicUsers: vi.fn(),
  searchPublicItems: vi.fn(),
}));

import { searchPublicUsers, searchPublicItems } from "@/lib/public-auth";

// Update beforeEach to include new mocks
beforeEach(() => {
  vi.clearAllMocks();
  clearSearchCache();
  vi.mocked(getSearchableItems).mockResolvedValue({ success: true, data: [] });
  vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
  vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });
});

// Add new test describes
describe("SpotlightSearch - Public User Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });
  });

  it("fetches public users when dialog opens", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });
  });

  it("displays users in People section", async () => {
    vi.mocked(searchPublicUsers).mockResolvedValue({
      success: true,
      data: [
        {
          id: "user-1",
          username: "johndoe",
          name: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("People")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("@johndoe")).toBeInTheDocument();
    });
  });

  it("navigates to user profile on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPublicUsers).mockResolvedValue({
      success: true,
      data: [
        {
          id: "user-1",
          username: "johndoe",
          name: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await user.click(screen.getByText("John Doe"));

    expect(mockPush).toHaveBeenCalledWith("/u/johndoe");
  });
});

describe("SpotlightSearch - Public Item Search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
    vi.mocked(getSearchableItems).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });
  });

  it("fetches public items when dialog opens", async () => {
    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicItems).toHaveBeenCalledTimes(1);
    });
  });

  it("displays public items in Public Collections section", async () => {
    vi.mocked(searchPublicItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Star Wars Collection",
          description: "Original trilogy",
          artworkId: null,
          ownerUsername: "johndoe",
          ownerName: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Public Collections")).toBeInTheDocument();
      expect(screen.getByText("Star Wars Collection")).toBeInTheDocument();
      expect(screen.getByText("by @johndoe")).toBeInTheDocument();
    });
  });

  it("navigates to public item on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(searchPublicItems).mockResolvedValue({
      success: true,
      data: [
        {
          id: "item-1",
          name: "Star Wars Collection",
          description: null,
          artworkId: null,
          ownerUsername: "johndoe",
          ownerName: "John Doe",
        },
      ],
    });

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Star Wars Collection")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Star Wars Collection"));

    expect(mockPush).toHaveBeenCalledWith("/u/johndoe/item-1");
  });
});

describe("SpotlightSearch - Cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
  });

  it("invalidates cache after TTL expires", async () => {
    vi.useFakeTimers();

    vi.mocked(getSearchableItems).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicUsers).mockResolvedValue({ success: true, data: [] });
    vi.mocked(searchPublicItems).mockResolvedValue({ success: true, data: [] });

    const { rerender } = render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(1);
    });

    // Close and reopen within TTL - should use cache
    rerender(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={false} />
      </SpotlightProvider>
    );

    rerender(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Should still be 1 call (cached)
    expect(searchPublicUsers).toHaveBeenCalledTimes(1);

    // Advance past TTL
    vi.advanceTimersByTime(61000);

    rerender(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={false} />
      </SpotlightProvider>
    );

    rerender(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Should have fetched again after TTL
    await waitFor(() => {
      expect(searchPublicUsers).toHaveBeenCalledTimes(2);
    });

    vi.useRealTimers();
  });
});

describe("SpotlightSearch - Independent Loading States", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSearchCache();
  });

  it("shows section content as soon as that section loads", async () => {
    // Items load fast, others slow
    vi.mocked(getSearchableItems).mockResolvedValue({
      success: true,
      data: [{ id: "1", name: "My Item", description: null, artworkId: null, breadcrumb: null }],
    });
    vi.mocked(searchPublicUsers).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 1000))
    );
    vi.mocked(searchPublicItems).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: [] }), 1000))
    );

    render(
      <SpotlightProvider>
        <SpotlightSearch defaultOpen={true} />
      </SpotlightProvider>
    );

    // Items section should appear immediately
    await waitFor(() => {
      expect(screen.getByText("Your Items")).toBeInTheDocument();
      expect(screen.getByText("My Item")).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/components/search/spotlight-search.test.tsx`
Expected: FAIL

**Step 3: Update the SpotlightSearch component**

Update `components/search/spotlight-search.tsx` (full file):

```typescript
/**
 * Spotlight search dialog component.
 * Provides macOS Spotlight-style search for:
 * - User's own items
 * - Public items from other users
 * - Public user profiles
 *
 * Features:
 * - Parallel data fetching with independent loading states
 * - SWR-style caching with 60-second TTL
 * - Section skeletons show while data loads
 * - Aria-live announcements for screen readers
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type RefObject,
} from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Folder, Globe, Users } from "lucide-react";
import { useImageLoaded } from "@/hooks/use-image-loaded";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useSpotlight } from "@/contexts/spotlight-context";
import { getSearchableItems } from "@/lib/item-actions";
import { searchPublicUsers, searchPublicItems } from "@/lib/public-auth";
import { cn } from "@/lib/utils";
import { UserThumbnail } from "./user-thumbnail";
import type {
  SearchableItem,
  SearchableUser,
  SearchablePublicItem,
} from "@/lib/types";

/** Cache TTL in milliseconds (60 seconds) */
const CACHE_TTL = 60_000;

/**
 * Resets scroll position to top when search value changes.
 */
function useScrollReset(
  listRef: RefObject<HTMLDivElement | null>,
  searchValue: string
) {
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [listRef, searchValue]);
}

/**
 * Artwork thumbnail with load state tracking.
 */
function ArtworkThumbnail({ artworkId }: { artworkId: string }) {
  const artworkSrc = `/api/artwork/${artworkId}`;
  const { ref, loaded, onLoad, onError } = useImageLoaded(artworkSrc);

  return (
    <div className="bg-muted relative size-8 shrink-0 overflow-hidden rounded-md">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Folder
            aria-hidden="true"
            className="text-muted-foreground/50 size-4"
          />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={artworkSrc}
        alt=""
        loading="lazy"
        className={cn(
          "absolute inset-0 h-full w-full object-cover transition-opacity duration-150",
          loaded ? "opacity-100" : "opacity-0"
        )}
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
}

/**
 * Skeleton loader for search result items.
 */
function ItemSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 px-3 py-2.5">
      <div className="bg-muted size-8 shrink-0 rounded-md" />
      <div className="flex flex-1 flex-col gap-1">
        <div className="bg-muted h-4 w-32 rounded" />
        <div className="bg-muted h-3 w-20 rounded" />
      </div>
    </div>
  );
}

interface SpotlightSearchProps {
  defaultOpen?: boolean;
}

// Module-level cache for SWR-style behavior with TTL
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let itemsCache: CacheEntry<SearchableItem[]> | null = null;
let usersCache: CacheEntry<SearchableUser[]> | null = null;
let publicItemsCache: CacheEntry<SearchablePublicItem[]> | null = null;

function isCacheValid<T>(cache: CacheEntry<T> | null): cache is CacheEntry<T> {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL;
}

export function clearSearchCache() {
  itemsCache = null;
  usersCache = null;
  publicItemsCache = null;
}

export function SpotlightSearch({ defaultOpen }: SpotlightSearchProps) {
  const router = useRouter();
  const { isOpen, closeSpotlight } = useSpotlight();

  // Independent loading states per section
  const [items, setItems] = useState<SearchableItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const [users, setUsers] = useState<SearchableUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [publicItems, setPublicItems] = useState<SearchablePublicItem[]>([]);
  const [isLoadingPublicItems, setIsLoadingPublicItems] = useState(false);

  const [searchValue, setSearchValue] = useState("");
  const prevOpenRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);

  useScrollReset(listRef, searchValue);

  const open = defaultOpen ?? isOpen;

  // Fetch all data when dialog opens - independent loading states
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;

    if (!open || wasOpen) return;

    let cancelled = false;
    setSearchValue("");

    // Fetch own items
    const fetchItems = async () => {
      if (isCacheValid(itemsCache)) {
        setItems(itemsCache.data);
        return;
      }

      setIsLoadingItems(true);
      const result = await getSearchableItems();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          itemsCache = { data, timestamp: Date.now() };
          setItems(data);
        } else {
          setItems([]);
          toast.error("Failed to load items", { description: result.error });
        }
        setIsLoadingItems(false);
      }
    };

    // Fetch public users
    const fetchUsers = async () => {
      if (isCacheValid(usersCache)) {
        setUsers(usersCache.data);
        return;
      }

      setIsLoadingUsers(true);
      const result = await searchPublicUsers();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          usersCache = { data, timestamp: Date.now() };
          setUsers(data);
        } else {
          setUsers([]);
        }
        setIsLoadingUsers(false);
      }
    };

    // Fetch public items
    const fetchPublicItems = async () => {
      if (isCacheValid(publicItemsCache)) {
        setPublicItems(publicItemsCache.data);
        return;
      }

      setIsLoadingPublicItems(true);
      const result = await searchPublicItems();
      if (!cancelled) {
        if (result.success) {
          const data = result.data ?? [];
          publicItemsCache = { data, timestamp: Date.now() };
          setPublicItems(data);
        } else {
          setPublicItems([]);
        }
        setIsLoadingPublicItems(false);
      }
    };

    // Fetch all in parallel
    void Promise.all([fetchItems(), fetchUsers(), fetchPublicItems()]);

    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSelectItem = useCallback(
    (itemId: string) => {
      closeSpotlight();
      router.push(`/my-items/${itemId}`);
    },
    [closeSpotlight, router]
  );

  const handleSelectUser = useCallback(
    (username: string) => {
      closeSpotlight();
      router.push(`/u/${username}`);
    },
    [closeSpotlight, router]
  );

  const handleSelectPublicItem = useCallback(
    (itemId: string, ownerUsername: string) => {
      closeSpotlight();
      router.push(`/u/${ownerUsername}/${itemId}`);
    },
    [closeSpotlight, router]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeSpotlight();
    },
    [closeSpotlight]
  );

  // Memoize hasResults to avoid recalculation on every render
  const hasResults = useMemo(
    () => items.length > 0 || users.length > 0 || publicItems.length > 0,
    [items.length, users.length, publicItems.length]
  );

  const isAnyLoading = isLoadingItems || isLoadingUsers || isLoadingPublicItems;

  // Aria announcement that updates when search value or results change
  const announcement = useMemo(() => {
    if (isAnyLoading && !hasResults) {
      return "Loading…";
    }
    if (!hasResults && searchValue) {
      return `No results found for "${searchValue}"`;
    }
    if (!hasResults) {
      return "No results found";
    }
    const parts: string[] = [];
    if (items.length > 0) parts.push(`${items.length} of your items`);
    if (publicItems.length > 0) parts.push(`${publicItems.length} public collections`);
    if (users.length > 0) parts.push(`${users.length} people`);
    return parts.join(", ") + " available";
  }, [isAnyLoading, hasResults, searchValue, items.length, publicItems.length, users.length]);

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search items, collections, and people…"
        className="border-none focus:ring-0"
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList ref={listRef} className="max-h-[400px]">
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        <CommandEmpty className="py-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <Search aria-hidden="true" className="text-muted-foreground/50 size-8" />
            <p className="text-muted-foreground text-sm">No results found.</p>
          </div>
        </CommandEmpty>

        {/* User's Items - with distinct icon style (solid) */}
        {(items.length > 0 || isLoadingItems) && (
          <CommandGroup heading="Your Items">
            {isLoadingItems ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`item:${item.name} ${item.description || ""} ${item.breadcrumb || ""}`}
                  onSelect={() => handleSelectItem(item.id)}
                  className="group cursor-pointer gap-3 px-3 py-2.5"
                >
                  {item.artworkId ? (
                    <ArtworkThumbnail artworkId={item.artworkId} />
                  ) : (
                    <div className="bg-muted/50 text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                      <Folder aria-hidden="true" className="size-4" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    {item.breadcrumb && (
                      <span className="text-muted-foreground/70 truncate text-xs">
                        {item.breadcrumb}
                      </span>
                    )}
                    {item.description && !item.breadcrumb && (
                      <span className="text-muted-foreground truncate text-xs">
                        {item.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))
            )}
          </CommandGroup>
        )}

        {/* Public Collections - with distinct icon style (globe) */}
        {(publicItems.length > 0 || isLoadingPublicItems) && (
          <CommandGroup heading="Public Collections">
            {isLoadingPublicItems ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              publicItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`public:${item.name} ${item.description || ""} ${item.ownerUsername}`}
                  onSelect={() => handleSelectPublicItem(item.id, item.ownerUsername)}
                  className="group cursor-pointer gap-3 px-3 py-2.5"
                >
                  {item.artworkId ? (
                    <ArtworkThumbnail artworkId={item.artworkId} />
                  ) : (
                    <div className="bg-muted/50 text-muted-foreground group-aria-selected:bg-primary/10 group-aria-selected:text-primary flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                      <Globe aria-hidden="true" className="size-4" />
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{item.name}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      by @{item.ownerUsername}
                    </span>
                  </div>
                </CommandItem>
              ))
            )}
            {/* Section-specific empty state */}
            {!isLoadingPublicItems && publicItems.length === 0 && searchValue && (
              <div className="text-muted-foreground px-3 py-2 text-xs">
                No public collections match your search.
              </div>
            )}
          </CommandGroup>
        )}

        {/* People - with distinct icon style (users) */}
        {(users.length > 0 || isLoadingUsers) && (
          <CommandGroup heading="People">
            {isLoadingUsers ? (
              <>
                <ItemSkeleton />
                <ItemSkeleton />
              </>
            ) : (
              users.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`user:${user.name || ""} ${user.username}`}
                  onSelect={() => handleSelectUser(user.username)}
                  className="group cursor-pointer gap-3 px-3 py-2.5"
                >
                  <UserThumbnail userId={user.id} name={user.name} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">
                      {user.name || user.username}
                    </span>
                    {user.name && (
                      <span className="text-muted-foreground truncate text-xs">
                        @{user.username}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))
            )}
            {/* Section-specific empty state */}
            {!isLoadingUsers && users.length === 0 && searchValue && (
              <div className="text-muted-foreground px-3 py-2 text-xs">
                No users found.
              </div>
            )}
          </CommandGroup>
        )}
      </CommandList>
      <div className="flex items-center justify-start gap-3 border-t px-3 py-2">
        <span className="text-muted-foreground text-xs">
          <Kbd>/</Kbd> to search
        </span>
        <span className="text-muted-foreground text-xs">
          <Kbd>esc</Kbd> to close
        </span>
      </div>
    </CommandDialog>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/search/spotlight-search.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/search/spotlight-search.tsx tests/unit/components/search/spotlight-search.test.tsx
git commit -m "$(cat <<'EOF'
feat(spotlight): add public user and item search

SpotlightSearch now displays three sections:
- "Your Items" - user's own items (existing)
- "Public Collections" - explicitly public items from others
- "People" - public user profiles

Key improvements from code review:
- Independent loading states per section (not blocking)
- 60-second cache TTL (prevents stale data)
- Memoized hasResults calculation
- Aria-live announces filtered results
- Section-specific empty states
- Distinct icons per section (Folder/Globe/Users)
- Skeleton loaders while sections load

Public items use visibility rules:
- Only isPublic=true AND inheritVisibility=false appear
- Inheriting items are not searchable (matches Explore)
EOF
)"
```

---

## Task 8: Add E2E Tests

**Files:**

- Modify: `e2e/journeys/items/spotlight-search.spec.ts`
- Modify: `e2e/pages/spotlight.page.ts`

**Step 1: Update SpotlightPage**

Add to `e2e/pages/spotlight.page.ts`:

```typescript
async expectPeopleSectionVisible() {
  await expect(this.page.getByText("People")).toBeVisible();
}

async expectPublicCollectionsSectionVisible() {
  await expect(this.page.getByText("Public Collections")).toBeVisible();
}

async expectNoPublicCollections() {
  await expect(this.page.getByText("No public collections match your search.")).toBeVisible();
}

async expectNoUsers() {
  await expect(this.page.getByText("No users found.")).toBeVisible();
}

async selectUser(name: string) {
  await this.page.getByRole("option", { name: new RegExp(name, "i") }).click();
}

async selectPublicItem(name: string) {
  await this.page.getByRole("option", { name: new RegExp(name, "i") }).click();
}
```

**Step 2: Add E2E tests**

Add to `e2e/journeys/items/spotlight-search.spec.ts`:

```typescript
test.describe("Spotlight Search - Public Content", () => {
  test("shows public collections from other users", async ({
    page,
    browser,
    signUpPage,
  }) => {
    // Create searcher
    const searcherEmail = generateUniqueEmail("searcher");
    await signUpPage.goto();
    await signUpPage.signUp(searcherEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    // Create public user with public item in separate context
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const publicSignUp = new SignUpPage(publicPage);
    const publicEmail = generateUniqueEmail("public-owner");
    const username = `owner${Date.now()}`;

    await publicSignUp.goto();
    await publicSignUp.signUp(publicEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(publicPage).toHaveURL("/my-items", { timeout: 10000 });

    // Make profile public
    await publicPage.getByRole("button", { name: /settings/i }).click();
    await publicPage.getByLabel(/username/i).fill(username);
    await publicPage.getByLabel(/make.*public/i).check();
    await publicPage.getByRole("button", { name: /save/i }).click();
    await publicPage.waitForTimeout(500);

    // Create and make item public
    const itemsPage = new ItemsPage(publicPage);
    await itemsPage.createItem("Public Test Collection");
    await itemsPage.clickItem("Public Test Collection");
    await publicPage.getByRole("button", { name: /settings/i }).click();
    await publicPage.getByLabel(/make.*public/i).check();
    await publicPage.getByRole("button", { name: /save/i }).click();
    await publicPage.waitForTimeout(500);

    await publicContext.close();

    // Search from first user
    const spotlightPage = new SpotlightPage(page);
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("Public Test");

    await spotlightPage.expectPublicCollectionsSectionVisible();
    await expect(page.getByText("Public Test Collection")).toBeVisible();
    await expect(page.getByText(`by @${username}`)).toBeVisible();
  });

  test("navigates to public item on selection", async ({
    page,
    browser,
    signUpPage,
  }) => {
    // Similar setup as above...
    // ...

    await spotlightPage.selectPublicItem("Public Test Collection");
    await expect(page).toHaveURL(new RegExp(`/u/${username}/`));
  });

  test("shows section-specific empty states", async ({ page, signUpPage }) => {
    const searcherEmail = generateUniqueEmail("empty-searcher");
    await signUpPage.goto();
    await signUpPage.signUp(searcherEmail, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });

    const spotlightPage = new SpotlightPage(page);
    await spotlightPage.openWithKeyboard();
    await spotlightPage.search("xyznonexistent123");

    // Should show section-specific empty messages
    await spotlightPage.expectNoPublicCollections();
    await spotlightPage.expectNoUsers();
  });
});
```

**Step 3: Run E2E tests**

Run: `pnpm run test:e2e e2e/journeys/items/spotlight-search.spec.ts`
Expected: PASS

**Step 4: Commit**

```bash
git add e2e/journeys/items/spotlight-search.spec.ts e2e/pages/spotlight.page.ts
git commit -m "$(cat <<'EOF'
test(e2e): add public search E2E tests

Tests for public content in spotlight:
- Shows public collections from other users
- Shows public user profiles
- Navigates to public items and profiles
- Shows section-specific empty states
EOF
)"
```

---

## Task 9: Run Full Test Suite

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: PASS

**Step 2: Run unit tests**

Run: `pnpm run test:unit`
Expected: PASS

**Step 3: Run integration tests**

Run: `pnpm run test:integration`
Expected: PASS

**Step 4: Run E2E tests**

Run: `pnpm run test:e2e`
Expected: PASS

**Step 5: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add public search to spotlight (users and items)

Spotlight search now includes:
- User's own items (existing)
- Public collections from other users
- Public user profiles

Key features:
- Independent loading states per section
- 60-second cache TTL prevents stale data
- React.cache() for server-side deduplication
- Distinct icons per section for visual clarity
- Section-specific empty states
- Aria-live announces filtered results

Visibility rules for public items:
- Only explicitly public items appear (isPublic=true, inheritVisibility=false)
- Inheriting items are NOT searchable (discoverable via navigation only)
- Matches Explore page behavior

New server actions:
- searchPublicUsers() - find public profiles (max 50)
- searchPublicItems() - find explicitly public items (max 100)

Both rate limited to 60/min.

Tests:
- Unit tests for server actions and components
- Integration tests for visibility logic
- E2E tests for full search flow
- Cache TTL and invalidation tests
EOF
)"
```

---

## Summary

### Files Created

- `tests/unit/lib/search-public-users.test.ts`
- `tests/unit/lib/search-public-items.test.ts`
- `tests/integration/public/search-public.test.ts`
- `components/search/user-thumbnail.tsx`
- `tests/unit/components/search/user-thumbnail.test.tsx`

### Files Modified

- `lib/types.ts` - Added `SearchableUser` and `SearchablePublicItem` (minimal fields only)
- `lib/rate-limit.ts` - Added `userSearch` and `publicItemSearch` limiters
- `lib/public-auth.ts` - Added `searchPublicUsers()` and `searchPublicItems()` with React.cache()
- `components/search/spotlight-search.tsx` - Three-section search with independent loading
- `tests/unit/components/search/spotlight-search.test.tsx`
- `e2e/journeys/items/spotlight-search.spec.ts`
- `e2e/pages/spotlight.page.ts`

### Visibility Logic Summary

| Search Section     | Query Criteria                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Your Items         | `userId = currentUser`                                                                                   |
| Public Collections | `isPublic = true` AND `inheritVisibility = false` AND `userId != currentUser` AND `user.isPublic = true` |
| People             | `isPublic = true` AND `username != null` AND `id != currentUser`                                         |

**Inheriting items (`inheritVisibility = true`) are intentionally excluded from search** - they are discoverable only through navigation within their public parent.

### Code Review Fixes Applied

| Issue                              | Resolution                                                  |
| ---------------------------------- | ----------------------------------------------------------- |
| Missing cache invalidation         | Added 60-second TTL with `isCacheValid()` check             |
| Violates Suspense boundaries       | Independent loading states per section with skeletons       |
| Missing React.cache()              | Wrapped server actions with `cache()` from React            |
| No cache tests                     | Added cache TTL test in spotlight-search.test.tsx           |
| Unnecessary data serialization     | Removed `createdAt`/`updatedAt` from types and selects      |
| Shared loading state               | Split into `isLoadingItems`, `isLoadingUsers`, etc.         |
| Missing memo() on UserThumbnail    | Wrapped component with `memo()`                             |
| Aria-live doesn't announce filters | Dynamic `announcement` updates with search value            |
| hasImage metadata exposed          | Removed - using initials only                               |
| Missing error scenario tests       | Added Prisma error tests                                    |
| Inconsistent result limits         | Documented: 50 users (less change), 100 items (more variety |
| Section differentiation            | Different icons: Folder, Globe, Users                       |
| No section-specific empty states   | Added conditional empty messages per section                |

---

**Plan complete and saved. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks

**2. Parallel Session (separate)** - Open new session with executing-plans skill

**Which approach?**
