# Public Item Page Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring public item pages (`/u/[username]/[itemId]`) to feature parity with private item pages: tree/grid view toggle and hero collapse.

**Architecture:** Currently, public item pages use `getPublicChildItems()` which only fetches direct children. To enable tree view, we need `getPublicDescendants()` that fetches ALL descendants (like `getDescendants()` for private pages). The client will convert flat descendants to tree structure using existing `itemsToTree()` utility. Hero collapse uses existing `useHeroCollapse` hook. The function uses `React.cache()` for per-request deduplication (matching existing pattern in lib/public-auth.ts).

**Tech Stack:** Next.js App Router, Prisma (recursive CTE), React, existing Tree/ViewToggle components

**Excluded (intentional):** Media playback, progress tracking, edit mode, sync, filter dropdown (no meaningful filter options without file data) - these are owner-only features or require type extensions.

---

## Summary of Changes

| Type             | Action                                    | Location                                                    |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Backend          | Add `getPublicDescendants()` with cache() | `lib/public-auth.ts`                                        |
| Server           | Use descendants instead of children       | `app/(public)/u/[username]/[itemId]/page.tsx`               |
| Client           | Add ViewToggle, Tree view, Hero collapse  | `app/(public)/u/[username]/[itemId]/public-item-client.tsx` |
| Unit Test        | Add tests for `getPublicDescendants()`    | `tests/unit/lib/public-auth.test.ts`                        |
| Unit Test        | Add tests for tree depth conversion       | `tests/unit/components/public-item-client.test.tsx`         |
| Integration Test | Add descendants visibility tests          | `tests/integration/public/public-profile.test.ts`           |
| E2E Test         | Add view toggle and hero collapse tests   | `e2e/journeys/public/public-profile.spec.ts`                |

---

## Task 1: Add `getPublicDescendants()` Function

**Files:**

- Modify: `lib/public-auth.ts` (after `getPublicChildItems` ~line 386)

**Step 1.1: Write the failing unit test**

Add to `tests/unit/lib/public-auth.test.ts` after the `getPublicChildItems` describe block:

```typescript
describe("getPublicDescendants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when parent is not public", async () => {
    mockQueryRaw.mockResolvedValue([{ is_fully_public: false }]);

    const result = await getPublicDescendants("parent-1");

    expect(result).toEqual([]);
    expect(mockItemFindMany).not.toHaveBeenCalled();
  });

  it("returns empty array when parent has no descendants", async () => {
    // Parent is public
    mockQueryRaw
      .mockResolvedValueOnce([{ is_fully_public: true }]) // isItemFullyPublic
      .mockResolvedValueOnce([]); // descendants CTE
    mockItemFindMany.mockResolvedValue([]);

    const result = await getPublicDescendants("parent-1");

    expect(result).toEqual([]);
  });

  it("returns all public descendants with correct structure", async () => {
    // Parent is public
    mockQueryRaw
      .mockResolvedValueOnce([{ is_fully_public: true }]) // isItemFullyPublic
      .mockResolvedValueOnce([{ id: "child-1" }, { id: "grandchild-1" }]); // descendants CTE

    mockItemFindMany.mockResolvedValue([
      mockItem({
        id: "child-1",
        name: "Season 1",
        parentId: "parent-1",
        depth: 1,
        order: 0,
      }),
      mockItem({
        id: "grandchild-1",
        name: "Episode 1",
        parentId: "child-1",
        depth: 2,
        order: 0,
      }),
    ] as never);

    const result = await getPublicDescendants("parent-1");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Season 1");
    expect(result[0].parentId).toBe("parent-1");
    expect(result[1].name).toBe("Episode 1");
    expect(result[1].parentId).toBe("child-1");
  });

  it("orders descendants by depth then order", async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ is_fully_public: true }])
      .mockResolvedValueOnce([{ id: "a" }, { id: "b" }, { id: "c" }]);

    mockItemFindMany.mockResolvedValue([
      mockItem({ id: "a", name: "First", depth: 1, order: 0 }),
      mockItem({ id: "b", name: "Second", depth: 1, order: 1 }),
      mockItem({ id: "c", name: "Nested", depth: 2, order: 0 }),
    ] as never);

    await getPublicDescendants("parent-1");

    expect(mockItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ depth: "asc" }, { order: "asc" }],
      })
    );
  });
});
```

**Step 1.2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/public-auth.test.ts -t "getPublicDescendants"`
Expected: FAIL with "getPublicDescendants is not exported"

**Step 1.3: Write the implementation**

Add to `lib/public-auth.ts` after `getPublicChildItems` function:

```typescript
/**
 * Maximum number of descendants to return (prevents large payloads).
 * Public trees beyond this size should use pagination.
 */
const MAX_PUBLIC_DESCENDANTS = 500;

/**
 * Fetches all public descendants of a parent item.
 * Returns children, grandchildren, etc. that are effectively public.
 * Used for tree view on public item pages.
 *
 * Uses React.cache() for per-request deduplication (matches existing pattern).
 * Limits results to MAX_PUBLIC_DESCENDANTS for performance.
 *
 * @param parentId - Parent item ID
 * @returns Array of all public descendants ordered by depth then order
 */
export const getPublicDescendants = cache(
  async (parentId: string): Promise<PublicItem[]> => {
    // Fetch parent data and check visibility in parallel (avoid waterfall)
    const [parentIsPublic, parent] = await Promise.all([
      isItemFullyPublic(parentId),
      prisma.item.findUnique({
        where: { id: parentId },
        select: { userId: true, depth: true },
      }),
    ]);

    // Early return if not public or not found
    if (!parentIsPublic || !parent) {
      return [];
    }

    // Use recursive CTE to get all descendants that are effectively public
    // Items are public if: explicit (inheritVisibility=false, isPublic=true)
    // OR inheriting (inheritVisibility=true) from a public ancestor chain
    // Includes depth limit (max 10 levels) for defense-in-depth
    const descendants = await prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE descendants AS (
        -- Direct children that are effectively public
        SELECT id, "parentId", depth
        FROM "Item"
        WHERE "parentId" = ${parentId}
          AND "userId" = ${parent.userId}
          AND depth <= ${parent.depth + 10}
          AND (
            -- Explicitly public
            ("inheritVisibility" = false AND "isPublic" = true)
            OR
            -- Inheriting visibility (parent is verified public above)
            "inheritVisibility" = true
          )

        UNION ALL

        -- Recurse to children of public items
        SELECT i.id, i."parentId", i.depth
        FROM "Item" i
        INNER JOIN descendants d ON i."parentId" = d.id
        WHERE i."userId" = ${parent.userId}
          AND i.depth <= ${parent.depth + 10}
          AND (
            ("inheritVisibility" = false AND "isPublic" = true)
            OR
            "inheritVisibility" = true
          )
      )
      SELECT id FROM descendants
      LIMIT ${MAX_PUBLIC_DESCENDANTS}
    `;

    const descendantIds = descendants.map((d) => d.id);

    if (descendantIds.length === 0) {
      return [];
    }

    // Fetch full item data
    const items = await prisma.item.findMany({
      where: { id: { in: descendantIds } },
      orderBy: [{ depth: "asc" }, { order: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        parentId: true,
        depth: true,
        userId: true,
        tmdbId: true,
        tmdbType: true,
        updatedAt: true,
        order: true,
        files: {
          where: { fileType: "ARTWORK" },
          select: { id: true },
          take: 1,
          orderBy: { isPrimary: "desc" },
        },
        _count: {
          select: { sourceForks: true },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      parentId: item.parentId,
      depth: item.depth,
      userId: item.userId,
      artworkId: item.files[0]?.id ?? null,
      tmdbId: item.tmdbId,
      tmdbType: item.tmdbType,
      forkCount: item._count.sourceForks,
      updatedAt: item.updatedAt,
    }));
  }
);
```

**Step 1.4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/public-auth.test.ts -t "getPublicDescendants"`
Expected: PASS

**Step 1.5: Commit**

```bash
git add lib/public-auth.ts tests/unit/lib/public-auth.test.ts
git commit -m "$(cat <<'EOF'
feat(public): add getPublicDescendants for tree view support

Adds function to fetch all public descendants of an item using recursive
CTE. Includes:
- React.cache() for per-request deduplication
- Parallel queries to avoid waterfall (isItemFullyPublic + findUnique)
- Depth limit (max 10 levels) for defense-in-depth
- Max 500 descendants limit to prevent large payloads
EOF
)"
```

---

## Task 2: Add Integration Tests for Descendants

**Files:**

- Modify: `tests/integration/public/public-profile.test.ts`

**Step 2.1: Write the integration tests**

Add to `tests/integration/public/public-profile.test.ts` after the `getPublicChildItems` describe block:

```typescript
describe("getPublicDescendants", () => {
  it("returns all descendants in a public hierarchy", async () => {
    const { user } = await createTestUser("descendants-all");

    try {
      // Create: Public Parent > Public Child > Public Grandchild
      const parent = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Parent",
          isPublic: true,
          inheritVisibility: false,
          order: 0,
          depth: 0,
        },
      });

      const child = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Child",
          isPublic: true,
          inheritVisibility: false,
          parentId: parent.id,
          order: 0,
          depth: 1,
        },
      });

      await prisma.item.create({
        data: {
          userId: user.id,
          name: "Grandchild",
          isPublic: true,
          inheritVisibility: false,
          parentId: child.id,
          order: 0,
          depth: 2,
        },
      });

      const descendants = await getPublicDescendants(parent.id);

      expect(descendants).toHaveLength(2);
      expect(descendants.map((d) => d.name)).toContain("Child");
      expect(descendants.map((d) => d.name)).toContain("Grandchild");
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("excludes private branches from descendants", async () => {
    const { user } = await createTestUser("descendants-private");

    try {
      const parent = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Parent",
          isPublic: true,
          inheritVisibility: false,
          order: 0,
          depth: 0,
        },
      });

      // Public child
      await prisma.item.create({
        data: {
          userId: user.id,
          name: "Public Child",
          isPublic: true,
          inheritVisibility: false,
          parentId: parent.id,
          order: 0,
          depth: 1,
        },
      });

      // Private child (should be excluded along with its children)
      const privateChild = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Private Child",
          isPublic: false,
          inheritVisibility: false,
          parentId: parent.id,
          order: 1,
          depth: 1,
        },
      });

      // Grandchild under private (should be excluded)
      await prisma.item.create({
        data: {
          userId: user.id,
          name: "Private Grandchild",
          isPublic: true,
          inheritVisibility: false,
          parentId: privateChild.id,
          order: 0,
          depth: 2,
        },
      });

      const descendants = await getPublicDescendants(parent.id);

      expect(descendants).toHaveLength(1);
      expect(descendants[0].name).toBe("Public Child");
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("includes inheriting descendants when chain is public", async () => {
    const { user } = await createTestUser("descendants-inherit");

    try {
      const parent = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Parent",
          isPublic: true,
          inheritVisibility: false,
          order: 0,
          depth: 0,
        },
      });

      // Inheriting child (should inherit public from parent)
      const child = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Inheriting Child",
          isPublic: false,
          inheritVisibility: true,
          parentId: parent.id,
          order: 0,
          depth: 1,
        },
      });

      // Inheriting grandchild (should inherit from inheriting child)
      await prisma.item.create({
        data: {
          userId: user.id,
          name: "Inheriting Grandchild",
          isPublic: false,
          inheritVisibility: true,
          parentId: child.id,
          order: 0,
          depth: 2,
        },
      });

      const descendants = await getPublicDescendants(parent.id);

      expect(descendants).toHaveLength(2);
      expect(descendants.map((d) => d.name)).toContain("Inheriting Child");
      expect(descendants.map((d) => d.name)).toContain("Inheriting Grandchild");
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("returns empty array when parent is not public", async () => {
    const { user } = await createTestUser("descendants-private-parent");

    try {
      const parent = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Private Parent",
          isPublic: false,
          inheritVisibility: false,
          order: 0,
          depth: 0,
        },
      });

      await prisma.item.create({
        data: {
          userId: user.id,
          name: "Child",
          isPublic: true,
          inheritVisibility: false,
          parentId: parent.id,
          order: 0,
          depth: 1,
        },
      });

      const descendants = await getPublicDescendants(parent.id);

      expect(descendants).toHaveLength(0);
    } finally {
      await cleanupUser(user.id);
    }
  });

  it("orders descendants by depth then order", async () => {
    const { user } = await createTestUser("descendants-order");

    try {
      const parent = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Parent",
          isPublic: true,
          order: 0,
          depth: 0,
        },
      });

      // Create in reverse order
      const child2 = await prisma.item.create({
        data: {
          userId: user.id,
          name: "Second",
          isPublic: true,
          parentId: parent.id,
          order: 1,
          depth: 1,
        },
      });

      await prisma.item.create({
        data: {
          userId: user.id,
          name: "First",
          isPublic: true,
          parentId: parent.id,
          order: 0,
          depth: 1,
        },
      });

      await prisma.item.create({
        data: {
          userId: user.id,
          name: "Nested Under Second",
          isPublic: true,
          parentId: child2.id,
          order: 0,
          depth: 2,
        },
      });

      const descendants = await getPublicDescendants(parent.id);

      expect(descendants).toHaveLength(3);
      // Depth 1 items first, in order
      expect(descendants[0].name).toBe("First");
      expect(descendants[1].name).toBe("Second");
      // Then depth 2
      expect(descendants[2].name).toBe("Nested Under Second");
    } finally {
      await cleanupUser(user.id);
    }
  });
});
```

**Step 2.2: Add import**

Update imports at top of file:

```typescript
import {
  getPublicProfile,
  isItemFullyPublic,
  getPublicItemsForUser,
  getPublicChildItems,
  getPublicDescendants, // Add this
} from "@/lib/public-auth";
```

**Step 2.3: Run integration tests**

Run: `pnpm test:integration tests/integration/public/public-profile.test.ts -t "getPublicDescendants"`
Expected: PASS

**Step 2.4: Commit**

```bash
git add tests/integration/public/public-profile.test.ts
git commit -m "$(cat <<'EOF'
test(integration): add getPublicDescendants tests

Tests visibility inheritance, private branch exclusion, and ordering
for the public descendants function.
EOF
)"
```

---

## Task 3: Update Server Page to Fetch Descendants

**Files:**

- Modify: `app/(public)/u/[username]/[itemId]/page.tsx`

**Step 3.1: Update import**

Change:

```typescript
import {
  getPublicProfile,
  getPublicItem,
  getPublicChildItems,
  getPublicBreadcrumb,
} from "@/lib/public-auth";
```

To:

```typescript
import {
  getPublicProfile,
  getPublicItem,
  getPublicDescendants,
  getPublicBreadcrumb,
} from "@/lib/public-auth";
```

**Step 3.2: Update data fetching**

Change line ~81:

```typescript
getPublicChildItems(itemId, 50, 0),
```

To:

```typescript
getPublicDescendants(itemId),
```

**Step 3.3: Verify type check passes**

Run: `pnpm type-check`
Expected: No errors (both return `PublicItem[]`)

**Step 3.4: Commit**

```bash
git add app/\(public\)/u/\[username\]/\[itemId\]/page.tsx
git commit -m "$(cat <<'EOF'
refactor(public): use getPublicDescendants for tree view support

Switch from getPublicChildItems (direct children only) to
getPublicDescendants (all descendants) to enable tree view.
EOF
)"
```

---

## Task 4: Add View Toggle and Tree View to Client

**Files:**

- Modify: `app/(public)/u/[username]/[itemId]/public-item-client.tsx`

**Step 4.1: Update imports**

Add these imports:

```typescript
import { ViewToggle, useStoredViewMode } from "@/components/items/view-toggle";
import { Tree } from "@/components/sortable-tree";
import { itemsToTree } from "@/lib/item-utils";
import type { TreeItems } from "@/lib/types";
```

**Step 4.2: Add view mode state**

In the component, after the sort state, add:

```typescript
const [viewMode, setViewMode] = useStoredViewMode();
```

**Step 4.3: Add tree data conversion**

After `sortedChildItems` memo, add:

```typescript
// Convert flat items to tree structure for Tree component
const treeItems: TreeItems = useMemo(() => {
  if (viewMode !== "tree" || childItems.length === 0) {
    return [];
  }

  // Map PublicItem to the structure expected by itemsToTree
  const itemsForTree = childItems.map((child, index) => ({
    id: child.id,
    name: child.name,
    description: child.description,
    parentId: child.parentId === item.id ? null : child.parentId, // Treat direct children as roots
    order: index,
    depth: child.depth - item.depth - 1, // Normalize depth relative to current item
    artworkId: child.artworkId,
  }));

  return itemsToTree(itemsForTree);
}, [viewMode, childItems, item.id, item.depth]);
```

**Step 4.4: Add ViewToggle to toolbar**

In the toolbar section (after SortDropdown), add ViewToggle:

```typescript
{/* Desktop: Sort dropdown and View toggle */}
<div className="hidden items-center gap-3 sm:flex">
  <SortDropdown
    value={sortBy}
    onChange={setSortBy}
    disabled={!hasChildren}
    options={EXPLORE_SORT_OPTIONS}
  />
  <ViewToggle
    value={viewMode}
    onChange={setViewMode}
    disabled={!hasChildren}
  />
</div>
```

**Step 4.5: Update MobileOptionsSheet props**

Add viewMode props to MobileOptionsSheet:

```typescript
<MobileOptionsSheet
  sortBy={sortBy}
  onSortChange={setSortBy}
  viewMode={viewMode}
  onViewModeChange={setViewMode}
  disabled={!hasChildren}
  sortOptions={EXPLORE_SORT_OPTIONS}
  defaultSort="updated-desc"
/>
```

**Step 4.6: Add tree view rendering**

Replace the grid rendering section with conditional rendering:

```typescript
{/* Child items grid/tree or empty state */}
{hasChildren ? (
  viewMode === "tree" ? (
    <Tree
      items={treeItems}
      onItemClick={handleItemClick}
      indentationWidth={20}
    />
  ) : (
    <div
      data-testid="items-grid-view"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
    >
      {sortedChildItems.map((child, index) => (
        <GridItem
          key={child.id}
          id={child.id}
          name={child.name}
          description={child.description}
          artworkId={child.artworkId}
          onClick={() => handleItemClick(child.id)}
          onMouseEnter={() => handleMouseEnter(child.id)}
          showArtwork={true}
          showDescription={true}
          priority={index < 8}
        />
      ))}
    </div>
  )
) : (
  <EmptyState variant="public-item-empty" />
)}
```

**Step 4.7: Verify it builds**

Run: `pnpm build`
Expected: Build succeeds

**Step 4.8: Commit**

```bash
git add app/\(public\)/u/\[username\]/\[itemId\]/public-item-client.tsx
git commit -m "$(cat <<'EOF'
feat(public): add tree/grid view toggle to public item pages

Public item pages now support both tree and grid views, matching
the functionality of private item pages.
EOF
)"
```

---

## Task 5: Add Hero Collapse

**Files:**

- Modify: `app/(public)/u/[username]/[itemId]/public-item-client.tsx`

**Note:** FilterDropdown is intentionally NOT added. A filter dropdown with only "All Items" option provides no value to users. FilterDropdown can be added later if `PublicItem` type is extended to include file information.

**Step 5.1: Add hero collapse import and hook**

Add to imports:

```typescript
import { useHeroCollapse } from "@/hooks/use-hero-collapse";
```

Add to component after view mode state:

```typescript
// Hero collapse state with localStorage persistence
const { isCollapsed, toggleCollapse } = useHeroCollapse();
```

**Step 5.2: Pass hero collapse props to ItemHero**

Update the ItemHero component usage:

```typescript
<ItemHero
  name={item.name}
  description={item.description}
  artworkId={item.artworkId}
  isCollapsed={isCollapsed}
  onCollapse={toggleCollapse}
/>
```

**Step 5.3: Verify it builds**

Run: `pnpm build`
Expected: Build succeeds

**Step 5.4: Commit**

```bash
git add app/\(public\)/u/\[username\]/\[itemId\]/public-item-client.tsx
git commit -m "$(cat <<'EOF'
feat(public): add hero collapse to public item pages

Public item pages now support collapsible hero banner with localStorage
persistence, matching the functionality of private item pages.
EOF
)"
```

---

## Task 5.5: Add Unit Test for Tree Depth Conversion

**Files:**

- Create: `tests/unit/components/public-item-client.test.tsx`

**Why:** The tree data conversion logic (depth normalization, parentId remapping to treat direct children as roots) is complex enough to warrant unit testing. This ensures the conversion from `PublicItem[]` to `TreeItems` works correctly for various scenarios.

**Step 5.5.1: Write the unit tests**

Create `tests/unit/components/public-item-client.test.tsx`:

```typescript
/**
 * Unit tests for PublicItemClient tree conversion logic.
 * Tests the conversion from PublicItem[] to TreeItems structure.
 */

import { describe, it, expect } from "vitest";
import { itemsToTree } from "@/lib/item-utils";
import type { PublicItem } from "@/lib/public-auth";

/**
 * Helper to convert PublicItem[] to tree structure.
 * Mirrors the logic in PublicItemClient useMemo.
 */
function convertPublicItemsToTree(
  childItems: PublicItem[],
  parentItemId: string,
  parentItemDepth: number
) {
  const itemsForTree = childItems.map((child, index) => ({
    id: child.id,
    name: child.name,
    description: child.description,
    parentId: child.parentId === parentItemId ? null : child.parentId,
    order: index,
    depth: child.depth - parentItemDepth - 1,
    artworkId: child.artworkId,
  }));

  return itemsToTree(itemsForTree);
}

describe("PublicItemClient tree conversion", () => {
  const mockPublicItem = (overrides: Partial<PublicItem>): PublicItem => ({
    id: "test-id",
    name: "Test Item",
    description: null,
    parentId: null,
    depth: 0,
    userId: "user-1",
    artworkId: null,
    tmdbId: null,
    tmdbType: null,
    forkCount: 0,
    updatedAt: new Date(),
    ...overrides,
  });

  it("treats direct children as roots (parentId becomes null)", () => {
    const parentId = "parent-1";
    const childItems: PublicItem[] = [
      mockPublicItem({ id: "child-1", name: "Child 1", parentId, depth: 1 }),
      mockPublicItem({ id: "child-2", name: "Child 2", parentId, depth: 1 }),
    ];

    const tree = convertPublicItemsToTree(childItems, parentId, 0);

    expect(tree).toHaveLength(2);
    expect(tree[0].parentId).toBeNull();
    expect(tree[1].parentId).toBeNull();
  });

  it("normalizes depth relative to parent item", () => {
    const parentId = "parent-1";
    const parentDepth = 2; // Parent is at depth 2
    const childItems: PublicItem[] = [
      mockPublicItem({ id: "child-1", parentId, depth: 3 }), // Should become depth 0
      mockPublicItem({ id: "grandchild-1", parentId: "child-1", depth: 4 }), // Should become depth 1
    ];

    const tree = convertPublicItemsToTree(childItems, parentId, parentDepth);

    expect(tree).toHaveLength(1); // Only direct child is root
    expect(tree[0].depth).toBe(0); // Normalized to 0
    expect(tree[0].children[0].depth).toBe(1); // Grandchild at depth 1
  });

  it("preserves nested structure (grandchildren under children)", () => {
    const parentId = "parent-1";
    const childItems: PublicItem[] = [
      mockPublicItem({ id: "child-1", name: "Season 1", parentId, depth: 1 }),
      mockPublicItem({
        id: "grandchild-1",
        name: "Episode 1",
        parentId: "child-1",
        depth: 2,
      }),
      mockPublicItem({
        id: "grandchild-2",
        name: "Episode 2",
        parentId: "child-1",
        depth: 2,
      }),
    ];

    const tree = convertPublicItemsToTree(childItems, parentId, 0);

    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("Season 1");
    expect(tree[0].children).toHaveLength(2);
    expect(tree[0].children[0].name).toBe("Episode 1");
    expect(tree[0].children[1].name).toBe("Episode 2");
  });

  it("handles empty array", () => {
    const tree = convertPublicItemsToTree([], "parent-1", 0);
    expect(tree).toEqual([]);
  });

  it("handles multiple levels of nesting", () => {
    const parentId = "parent-1";
    const childItems: PublicItem[] = [
      mockPublicItem({ id: "l1", name: "Level 1", parentId, depth: 1 }),
      mockPublicItem({
        id: "l2",
        name: "Level 2",
        parentId: "l1",
        depth: 2,
      }),
      mockPublicItem({
        id: "l3",
        name: "Level 3",
        parentId: "l2",
        depth: 3,
      }),
    ];

    const tree = convertPublicItemsToTree(childItems, parentId, 0);

    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].name).toBe("Level 3");
  });
});
```

**Step 5.5.2: Run test to verify it passes**

Run: `pnpm test tests/unit/components/public-item-client.test.tsx`
Expected: PASS

**Step 5.5.3: Commit**

```bash
git add tests/unit/components/public-item-client.test.tsx
git commit -m "$(cat <<'EOF'
test(unit): add tree depth conversion tests for public items

Tests the conversion logic that transforms PublicItem[] to TreeItems,
verifying depth normalization and parentId remapping work correctly.
EOF
)"
```

---

## Task 6: Add E2E Test for Hero Collapse

**Files:**

- Modify: `e2e/journeys/public/public-profile.spec.ts`

**Step 6.1: Add test for hero collapse**

Add to the "Public Profiles Journey" describe block:

```typescript
test("can collapse and expand hero on public item", async ({
  page,
  publicProfilePage,
  myItemsPage,
}) => {
  // Sign out first (handles mobile sidebar)
  await myItemsPage.signOut();
  await page.waitForURL("/", { timeout: 10000 });

  // Visit public item
  await publicProfilePage.gotoItem(ownerUsername, publicItemId);
  await publicProfilePage.expectHeroVisible("Public Test Collection");

  // Find collapse button (if visible - may not be on all screen sizes)
  const collapseButton = page.getByRole("button", { name: /collapse|expand/i });
  if (await collapseButton.isVisible()) {
    // Click to collapse
    await collapseButton.click();

    // Hero should be in collapsed state (smaller height)
    // Verify by checking the hero container has collapsed class or height
    await expect(page.locator("[data-hero-collapsed='true']")).toBeVisible();

    // Click to expand
    await collapseButton.click();
    await expect(page.locator("[data-hero-collapsed='false']")).toBeVisible();
  }
});
```

**Step 6.2: Run E2E test**

Run: `pnpm test:e2e e2e/journeys/public/public-profile.spec.ts -t "can collapse and expand hero"`
Expected: PASS

**Step 6.3: Commit**

```bash
git add e2e/journeys/public/public-profile.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add hero collapse test for public item pages

Verifies hero collapse toggle works correctly on public item pages.
EOF
)"
```

---

## Task 7: Add E2E Test for View Toggle

**Files:**

- Modify: `e2e/journeys/public/public-profile.spec.ts`

**Step 5.1: Add test for view toggle**

Add to the "Public Profiles Journey" describe block:

```typescript
test("can toggle between grid and tree view on public item", async ({
  page,
  publicProfilePage,
  myItemsPage,
}) => {
  // Create child items for the public item
  await prisma.item.create({
    data: {
      name: "Season 1",
      userId: ownerId,
      parentId: publicItemId,
      depth: 1,
      order: 0,
      isPublic: true,
      inheritVisibility: true,
    },
  });

  await prisma.item.create({
    data: {
      name: "Season 2",
      userId: ownerId,
      parentId: publicItemId,
      depth: 1,
      order: 1,
      isPublic: true,
      inheritVisibility: true,
    },
  });

  // Sign out first (handles mobile sidebar)
  await myItemsPage.signOut();
  await page.waitForURL("/", { timeout: 10000 });

  // Visit public item
  await publicProfilePage.gotoItem(ownerUsername, publicItemId);
  await publicProfilePage.expectHeroVisible("Public Test Collection");

  // Default should be grid view
  await expect(page.getByTestId("items-grid-view")).toBeVisible();

  // Click tree view toggle (desktop only - skip on mobile)
  const viewToggle = page.getByRole("button", { name: "Tree view" });
  if (await viewToggle.isVisible()) {
    await viewToggle.click();

    // Should show tree view
    await expect(page.getByTestId("items-tree-view")).toBeVisible();
    await expect(page.getByText("Season 1")).toBeVisible();
    await expect(page.getByText("Season 2")).toBeVisible();

    // Toggle back to grid
    await page.getByRole("button", { name: "Grid view" }).click();
    await expect(page.getByTestId("items-grid-view")).toBeVisible();
  }
});
```

**Step 5.2: Run E2E test**

Run: `pnpm test:e2e e2e/journeys/public/public-profile.spec.ts -t "can toggle between grid and tree view"`
Expected: PASS

**Step 5.3: Commit**

```bash
git add e2e/journeys/public/public-profile.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add view toggle test for public item pages

Verifies grid/tree view toggle works correctly on public item pages.
EOF
)"
```

---

## Task 8: Update MobileOptionsSheet for View Toggle (if needed)

**Files:**

- Check: `components/items/mobile-options-sheet.tsx`

**Step 8.1: Check if MobileOptionsSheet already supports viewMode**

Read the component to verify it accepts `viewMode` and `onViewModeChange` props.

**Step 8.2: If not supported, add props**

Add to the interface:

```typescript
viewMode?: ViewMode;
onViewModeChange?: (mode: ViewMode) => void;
```

Add ViewToggle inside the sheet content (if not already present).

**Step 8.3: Run checks**

Run: `pnpm check`
Expected: All checks pass

**Step 8.4: Commit (if changes made)**

```bash
git add components/items/mobile-options-sheet.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add view toggle to mobile options sheet
EOF
)"
```

---

## Task 9: Final Verification

**Step 9.1: Run all tests**

```bash
pnpm test
pnpm test:integration
pnpm test:e2e --project=chromium
```

**Step 9.2: Manual verification**

1. Go to a public item page with children
2. Verify grid view is default
3. Toggle to tree view - verify tree shows nested hierarchy
4. Click item in tree - verify navigates correctly
5. Toggle back to grid
6. Verify view preference persists across page reloads
7. Click hero collapse button - verify hero collapses
8. Verify hero collapse preference persists across page reloads

**Step 9.3: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: cleanup and verification for public item page parity
EOF
)"
```

---

## Tests Summary

### Unit Tests (Added/Modified)

| Test                                                        | File                                                | Description            |
| ----------------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| `getPublicDescendants returns empty when parent not public` | `tests/unit/lib/public-auth.test.ts`                | Security check         |
| `getPublicDescendants returns all public descendants`       | `tests/unit/lib/public-auth.test.ts`                | Core functionality     |
| `getPublicDescendants orders by depth then order`           | `tests/unit/lib/public-auth.test.ts`                | Ordering               |
| `treats direct children as roots (parentId becomes null)`   | `tests/unit/components/public-item-client.test.tsx` | Tree conversion        |
| `normalizes depth relative to parent item`                  | `tests/unit/components/public-item-client.test.tsx` | Depth normalization    |
| `preserves nested structure`                                | `tests/unit/components/public-item-client.test.tsx` | Hierarchy preservation |
| `handles multiple levels of nesting`                        | `tests/unit/components/public-item-client.test.tsx` | Deep nesting           |

### Integration Tests (Added)

| Test                                          | File                                              | Description |
| --------------------------------------------- | ------------------------------------------------- | ----------- |
| `returns all descendants in public hierarchy` | `tests/integration/public/public-profile.test.ts` | Happy path  |
| `excludes private branches`                   | `tests/integration/public/public-profile.test.ts` | Security    |
| `includes inheriting descendants`             | `tests/integration/public/public-profile.test.ts` | Inheritance |
| `returns empty when parent not public`        | `tests/integration/public/public-profile.test.ts` | Security    |
| `orders by depth then order`                  | `tests/integration/public/public-profile.test.ts` | Ordering    |

### E2E Tests (Added)

| Test                                    | File                                         | Description   |
| --------------------------------------- | -------------------------------------------- | ------------- |
| `can toggle between grid and tree view` | `e2e/journeys/public/public-profile.spec.ts` | View toggle   |
| `can collapse and expand hero`          | `e2e/journeys/public/public-profile.spec.ts` | Hero collapse |

### Tests NOT Changed

- Existing `getPublicChildItems` tests remain unchanged (function still exists for other uses)
- Existing public profile E2E tests remain unchanged
- Fork journey tests remain unchanged
