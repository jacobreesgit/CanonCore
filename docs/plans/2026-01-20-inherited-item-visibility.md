# Inherited Item Visibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `inheritVisibility` toggle to items so children can inherit public visibility from their parent, reducing visual clutter on Explore while maintaining deep linking capability.

**Architecture:** Items gain an `inheritVisibility` boolean (default: false for existing items, true for new children). When true, the item's effective visibility is inherited from its parent chain. When false, the item uses its own `isPublic` value. Explore only shows explicitly public items; profile pages and direct links work for all effectively-visible items.

**Tech Stack:** Prisma schema, PostgreSQL recursive CTEs, React components, Vitest, Playwright

---

## Code Review Findings

> The following issues were identified during code review and must be addressed during implementation.

### 🔴 Critical - Must Fix Before Merge

**CR-1: Data Migration Default Value**

- **Location:** Task 1, Schema Migration
- **Issue:** Using `@default(true)` changes semantics of all existing items - they'll suddenly inherit visibility, breaking current public items that are children of private parents.
- **Fix:** Use `@default(false)` in schema AND add explicit data migration:
  ```sql
  -- Set existing items to explicit (don't inherit)
  UPDATE "Item" SET "inheritVisibility" = false;
  ```

**CR-2: Security Gap in getPublicChildItems**

- **Location:** Task 3, lines 268-273
- **Issue:** Query returns all children with `inheritVisibility: true` regardless of parent's actual visibility. A private parent's inheriting children would be returned.
- **Fix:** Either:
  1. Verify parent is public before calling: `if (!await isItemFullyPublic(parentId)) return [];`
  2. OR add explicit JSDoc warning: `@precondition Parent MUST be verified public before calling`

### 🟡 Important - Should Fix

**CR-3: Forked Items Default**

- **Location:** `lib/fork-actions.ts` (not in plan)
- **Issue:** When forking items, `inheritVisibility` should default to `false` since forked items start private.
- **Fix:** Add to Task 1 or create new task to update fork logic.

**CR-4: Missing Down Migration**

- **Location:** Task 1
- **Issue:** No rollback plan if feature needs to be reverted.
- **Fix:** Add down migration step to Task 1.

**CR-5: Accessibility - Missing aria-describedby**

- **Location:** Task 7, VisibilityToggle component
- **Issue:** Inherit toggle lacks `aria-describedby` linking to help text.
- **Fix:** Add accessibility attributes in Task 7.

**CR-6: Performance Considerations**

- **Location:** Task 2, recursive CTE
- **Issue:** Deep hierarchies could cause slow queries. Need index and depth consideration.
- **Fix:** Verify `parentId` index exists; consider adding circuit breaker for depth > 10.

### 🟢 Nits - Nice to Have

**CR-7: Optimistic Updates**

- **Location:** Task 7
- **Issue:** Toggle handler doesn't use optimistic updates, causing UI lag.
- **Suggestion:** Consider `useOptimistic` or immediate state update with rollback on error.

**CR-8: Integration Test for Raw SQL**

- **Location:** Task 9
- **Issue:** Recursive CTE logic should have integration test against real PostgreSQL.
- **Suggestion:** Add explicit integration test for the raw query in Task 9.

---

## Current vs New Model

**Current:** Every item needs explicit `isPublic: true` to be visible. Results in 400+ items on Explore.

**New:**

```
Movies/           isPublic: false   (organizational folder)
├── Shawshank     inheritVisibility: false, isPublic: true  → Explore ✓
├── Godfather     inheritVisibility: false, isPublic: true  → Explore ✓
└── Dark Knight   inheritVisibility: false, isPublic: true  → Explore ✓

TV Shows/         isPublic: false   (organizational folder)
└── Breaking Bad  inheritVisibility: false, isPublic: true  → Explore ✓
    └── Season 1  inheritVisibility: true   (inherits from BB) → accessible, not on Explore
        └── Ep 1  inheritVisibility: true   (inherits from S1→BB) → accessible, not on Explore
```

**Rules:**

- `inheritVisibility: true` → isPublic toggle disabled in UI, uses parent's effective visibility
- `inheritVisibility: false` → isPublic toggle enabled, explicit choice
- Explore shows: `WHERE isPublic = true AND inheritVisibility = false` (explicitly shared items only)
- Accessibility: item is visible if `isPublic = true` OR (any ancestor has `isPublic = true` AND inherit chain is unbroken)

---

## Task 1: Schema Migration

**Files:**

- Create: `prisma/migrations/YYYYMMDDHHMMSS_add_inherit_visibility/migration.sql`
- Modify: `prisma/schema.prisma:129-193` (Item model)

**Step 1: Add field to schema**

In `prisma/schema.prisma`, add to Item model after `isPublic`:

```prisma
  // Visibility inheritance from parent
  inheritVisibility  Boolean  @default(false)  // false = explicit visibility, true = inherit from parent
```

> **Note (CR-1):** Using `@default(false)` ensures existing items maintain their current explicit behavior.

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_inherit_visibility`
Expected: Migration created successfully

**Step 3: Verify migration includes data safety**

Check generated migration file includes:

```sql
-- AlterTable
ALTER TABLE "Item" ADD COLUMN "inheritVisibility" BOOLEAN NOT NULL DEFAULT false;

-- Explicitly set existing items (safety measure)
UPDATE "Item" SET "inheritVisibility" = false;
```

If the UPDATE is not auto-generated, manually add it to the migration file.

**Step 4: Create down migration (CR-4)**

Create `prisma/migrations/YYYYMMDDHHMMSS_add_inherit_visibility/down.sql`:

```sql
-- Revert: Remove inheritVisibility column
ALTER TABLE "Item" DROP COLUMN "inheritVisibility";
```

**Step 5: Verify migration applied**

Run: `npx prisma migrate status`
Expected: All migrations applied

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add inheritVisibility field to Item model"
```

---

## Task 2: Update Public Auth Logic - isItemFullyPublic

**Files:**

- Modify: `lib/public-auth.ts:112-136`
- Test: `tests/unit/lib/public-auth.test.ts`

**Step 1: Write failing tests for new inheritance behavior**

Add to `tests/unit/lib/public-auth.test.ts` in `describe("isItemFullyPublic")`:

```typescript
it("returns true when item inherits from public ancestor", async () => {
  // Item has inheritVisibility=true and ancestor is public
  mockQueryRaw.mockResolvedValue([{ is_effectively_public: true }]);

  const result = await isItemFullyPublic("child-item");

  expect(result).toBe(true);
});

it("returns false when inherit chain is broken by non-inheriting private item", async () => {
  // Item inherits, but an ancestor has inheritVisibility=false and isPublic=false
  mockQueryRaw.mockResolvedValue([{ is_effectively_public: false }]);

  const result = await isItemFullyPublic("deep-child");

  expect(result).toBe(false);
});

it("returns true when item is explicitly public (inheritVisibility=false, isPublic=true)", async () => {
  mockQueryRaw.mockResolvedValue([{ is_effectively_public: true }]);

  const result = await isItemFullyPublic("explicit-public-item");

  expect(result).toBe(true);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/public-auth.test.ts -- --grep "isItemFullyPublic"`
Expected: New tests FAIL (query mock structure changed)

**Step 3: Update isItemFullyPublic implementation**

Replace `isItemFullyPublic` in `lib/public-auth.ts`:

```typescript
/**
 * Checks if an item is effectively public (directly or via inheritance).
 * An item is effectively public if:
 * 1. It has isPublic=true and inheritVisibility=false (explicit), OR
 * 2. It has inheritVisibility=true AND an ancestor in its chain is effectively public
 *
 * Uses recursive CTE to walk up the tree and determine effective visibility.
 * CTE terminates when it finds an item with inheritVisibility=false (the "resolver").
 *
 * @param itemId - Item ID to check
 * @returns True if item is effectively public
 */
export const isItemFullyPublic = cache(
  async (itemId: string): Promise<boolean> => {
    // Use recursive CTE to check effective visibility through inheritance chain
    const result = await prisma.$queryRaw<
      Array<{ is_effectively_public: boolean }>
    >`
    WITH RECURSIVE visibility_chain AS (
      -- Start with the target item
      SELECT
        id,
        "parentId",
        "isPublic",
        "inheritVisibility",
        CASE
          WHEN "inheritVisibility" = false THEN "isPublic"
          ELSE NULL  -- Need to check parent
        END as resolved_visibility
      FROM "Item"
      WHERE id = ${itemId}

      UNION ALL

      -- Walk up the tree for items that inherit
      SELECT
        i.id,
        i."parentId",
        i."isPublic",
        i."inheritVisibility",
        CASE
          WHEN i."inheritVisibility" = false THEN i."isPublic"
          ELSE NULL  -- Keep walking up
        END as resolved_visibility
      FROM "Item" i
      INNER JOIN visibility_chain vc ON i.id = vc."parentId"
      WHERE vc.resolved_visibility IS NULL  -- Only continue if still inheriting
    )
    SELECT COALESCE(
      -- Find the first resolved visibility in the chain
      (SELECT resolved_visibility FROM visibility_chain WHERE resolved_visibility IS NOT NULL LIMIT 1),
      -- If no explicit visibility found (all inherit up to root), default to false
      false
    ) as is_effectively_public
  `;

    return result[0]?.is_effectively_public ?? false;
  }
);
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/lib/public-auth.test.ts -- --grep "isItemFullyPublic"`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/public-auth.ts tests/unit/lib/public-auth.test.ts
git commit -m "feat: update isItemFullyPublic to support inheritance"
```

---

## Task 3: Update Public Auth Logic - getPublicChildItems

**Files:**

- Modify: `lib/public-auth.ts:302-350`
- Test: `tests/unit/lib/public-auth.test.ts`

**Step 1: Write failing tests**

Add to `tests/unit/lib/public-auth.test.ts` in `describe("getPublicChildItems")`:

```typescript
it("returns children that inherit visibility from public parent", async () => {
  mockItemFindMany.mockResolvedValue([
    mockItem({
      id: "child-1",
      name: "Inheriting Child",
      parentId: "parent-1",
      isPublic: false,
      inheritVisibility: true,
    }),
  ] as never);

  const result = await getPublicChildItems("parent-1");

  expect(result).toHaveLength(1);
  expect(result[0].name).toBe("Inheriting Child");
});

it("excludes children with inheritVisibility=false and isPublic=false", async () => {
  mockItemFindMany.mockResolvedValue([
    mockItem({
      id: "child-1",
      name: "Public Child",
      isPublic: true,
      inheritVisibility: false,
    }),
  ] as never);

  // Private non-inheriting child filtered out by query
  const result = await getPublicChildItems("parent-1");

  expect(result).toHaveLength(1);
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/public-auth.test.ts -- --grep "getPublicChildItems"`
Expected: New tests FAIL

**Step 3: Update getPublicChildItems**

Replace in `lib/public-auth.ts`:

```typescript
/**
 * Fetches effectively public child items of a parent item.
 * Returns children that are:
 * - Explicitly public (inheritVisibility=false, isPublic=true), OR
 * - Inheriting visibility (inheritVisibility=true) - parent visibility already verified
 *
 * @precondition Caller MUST verify parent is public before calling (CR-2 security requirement)
 *
 * @param parentId - Parent item ID
 * @param limit - Maximum items to return
 * @param offset - Pagination offset
 * @returns Array of effectively public child items
 */
export async function getPublicChildItems(
  parentId: string,
  limit = 50,
  offset = 0
): Promise<PublicItem[]> {
  // CR-2: Verify parent is actually public before returning inheriting children
  const parentIsPublic = await isItemFullyPublic(parentId);
  if (!parentIsPublic) {
    return [];
  }

  const items = await prisma.item.findMany({
    where: {
      parentId,
      OR: [
        // Explicitly public
        { inheritVisibility: false, isPublic: true },
        // Inheriting (parent verified public above)
        { inheritVisibility: true },
      ],
    },
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
    orderBy: { order: "asc" },
    take: limit,
    skip: offset,
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
```

**Step 4: Run tests**

Run: `pnpm run test:unit tests/unit/lib/public-auth.test.ts -- --grep "getPublicChildItems"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/public-auth.ts tests/unit/lib/public-auth.test.ts
git commit -m "feat: update getPublicChildItems to support inheritance"
```

---

## Task 4: Update Explore Query

**Files:**

- Modify: `lib/public-auth.ts:360-417` (getExploreItems)
- Test: `tests/unit/lib/public-auth.test.ts`

**Step 1: Write failing test**

Add to `describe("getExploreItems")`:

```typescript
it("excludes items that only inherit visibility", async () => {
  mockItemFindMany.mockResolvedValue([
    mockItem({
      id: "explicit",
      name: "Explicit Public",
      isPublic: true,
      inheritVisibility: false,
      user: { username: "testuser" },
    }),
    // Note: Query should filter out inheritVisibility=true items
  ] as never);

  const result = await getExploreItems();

  expect(result).toHaveLength(1);
  expect(result[0].name).toBe("Explicit Public");
});
```

**Step 2: Run test to fail**

Run: `pnpm run test:unit tests/unit/lib/public-auth.test.ts -- --grep "getExploreItems"`

**Step 3: Update getExploreItems**

In `lib/public-auth.ts`, update the where clause:

```typescript
export async function getExploreItems(
  limit = 50,
  offset = 0
): Promise<(PublicItem & { ownerUsername: string })[]> {
  const items = await prisma.item.findMany({
    where: {
      isPublic: true,
      inheritVisibility: false,  // Only explicitly public items
      user: {
        isPublic: true,
        username: { not: null },
      },
    },
    // ... rest unchanged
```

**Step 4: Run test**

Expected: PASS

**Step 5: Commit**

```bash
git add lib/public-auth.ts tests/unit/lib/public-auth.test.ts
git commit -m "feat: filter Explore to show only explicitly public items"
```

---

## Task 5: Update getPublicItemsForUser

**Files:**

- Modify: `lib/public-auth.ts:241-290`
- Test: `tests/unit/lib/public-auth.test.ts`

**Step 1: Write failing test**

Add to `describe("getPublicItemsForUser")`:

```typescript
it("returns explicitly public items for user profile", async () => {
  mockItemFindMany.mockResolvedValue([
    mockItem({
      id: "movie",
      name: "Shawshank",
      isPublic: true,
      inheritVisibility: false,
    }),
  ] as never);

  await getPublicItemsForUser("user-1");

  expect(mockItemFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        isPublic: true,
        inheritVisibility: false,
      }),
    })
  );
});
```

**Step 2: Update getPublicItemsForUser**

```typescript
export async function getPublicItemsForUser(
  userId: string,
  limit = 50,
  offset = 0
): Promise<PublicItem[]> {
  const items = await prisma.item.findMany({
    where: {
      userId,
      isPublic: true,
      inheritVisibility: false,  // Only explicitly public items on profile root
    },
    // ... rest unchanged
```

**Step 3: Run tests, commit**

```bash
git add lib/public-auth.ts tests/unit/lib/public-auth.test.ts
git commit -m "feat: update getPublicItemsForUser for explicit visibility"
```

---

## Task 6: Add setInheritVisibility Server Action

**Files:**

- Modify: `lib/item-actions.ts`
- Test: `tests/unit/lib/item-actions.test.ts`

**Step 1: Write failing tests**

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("setInheritVisibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockRateLimit.mockResolvedValue(null);
  });

  it("sets inheritVisibility on item", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      parentId: "parent-1", // Has parent
      inheritVisibility: false,
    });
    mockItemUpdate.mockResolvedValue({ id: "item-1" });

    const result = await setInheritVisibility("item-1", true);

    expect(result.success).toBe(true);
    expect(mockItemUpdate).toHaveBeenCalledWith({
      where: { id: "item-1" },
      data: { inheritVisibility: true },
    });
  });

  it("rejects setting inherit on root item (no parent)", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "root-1",
      userId: "user-1",
      parentId: null, // Root item
      inheritVisibility: false,
    });

    const result = await setInheritVisibility("root-1", true);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/root items cannot inherit/i);
  });

  it("rejects unauthorized user", async () => {
    mockItemFindUnique.mockResolvedValue({
      id: "item-1",
      userId: "other-user",
      parentId: "parent-1",
    });

    const result = await setInheritVisibility("item-1", true);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Unauthorized");
  });
});
```

**Step 2: Implement setInheritVisibility**

Add to `lib/item-actions.ts`:

```typescript
/**
 * Sets whether an item inherits visibility from its parent.
 * Root items (parentId=null) cannot inherit.
 *
 * @param id - Item ID
 * @param inheritVisibility - Whether to inherit visibility
 * @returns Success or error
 */
export async function setInheritVisibility(
  id: string,
  inheritVisibility: boolean
): Promise<ItemResult<void>> {
  const [rateLimitResult, session] = await Promise.all([
    checkRateLimit("itemUpdate"),
    auth(),
  ]);

  if (rateLimitResult) {
    return { error: rateLimitResult.error };
  }

  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const item = await prisma.item.findUnique({
    where: { id },
    select: { userId: true, parentId: true, inheritVisibility: true },
  });

  if (!item) {
    return { error: "Item not found" };
  }

  if (item.userId !== session.user.id) {
    return { error: "Unauthorized" };
  }

  // Root items cannot inherit
  if (inheritVisibility && item.parentId === null) {
    return { error: "Root items cannot inherit visibility" };
  }

  // No change needed
  if (item.inheritVisibility === inheritVisibility) {
    return { success: true };
  }

  try {
    await prisma.item.update({
      where: { id },
      data: { inheritVisibility },
    });

    logger.info(
      { userId: session.user.id, itemId: id, inheritVisibility },
      "Item inherit visibility updated"
    );

    return { success: true };
  } catch (error) {
    logger.error({ error, itemId: id }, "Failed to update inherit visibility");
    const prismaError = handlePrismaError(error);
    return prismaError ?? { error: "Failed to update visibility" };
  }
}
```

**Step 3: Export from item-actions.ts**

Add to exports at top of file.

**Step 4: Run tests, commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions.test.ts
git commit -m "feat: add setInheritVisibility server action"
```

---

## Task 7: Update Visibility Toggle Component

**Files:**

- Modify: `components/items/visibility-toggle.tsx`
- Test: `tests/unit/components/items/visibility-toggle.test.tsx` (if exists)

**Step 1: Update component props and logic**

```typescript
interface VisibilityToggleProps {
  itemId: string;
  isPublic: boolean;
  inheritVisibility: boolean;
  hasParent: boolean;  // true if item has a parent (can inherit)
  hasChildren?: boolean;
  onVisibilityChange?: (isPublic: boolean) => void;
  onInheritChange?: (inherit: boolean) => void;
  className?: string;
}

export function VisibilityToggle({
  itemId,
  isPublic,
  inheritVisibility,
  hasParent,
  hasChildren = false,
  onVisibilityChange,
  onInheritChange,
  className,
}: VisibilityToggleProps) {
  const [currentPublic, setCurrentPublic] = useState(isPublic);
  const [currentInherit, setCurrentInherit] = useState(inheritVisibility);
  const [isUpdating, setIsUpdating] = useState(false);
  const inheritHelpId = `inherit-help-${itemId}`;
  // ... existing state

  const handleInheritToggle = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      const result = await setInheritVisibility(itemId, checked);
      if (result.success) {
        setCurrentInherit(checked);
        onInheritChange?.(checked);
        toast.success(
          checked ? "Inheriting visibility from parent" : "Using explicit visibility"
        );
      } else {
        toast.error(result.error || "Failed to update");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Inherit toggle - only show for non-root items */}
      {hasParent && (
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <Link2 aria-hidden="true" className="h-5 w-5 text-muted-foreground" />
            <div className="space-y-0.5">
              <Label htmlFor={`inherit-${itemId}`} className="text-sm font-medium">
                Inherit from parent
              </Label>
              <p id={inheritHelpId} className="text-muted-foreground text-xs">
                Use the same visibility as the parent item
              </p>
            </div>
          </div>
          <Switch
            id={`inherit-${itemId}`}
            checked={currentInherit}
            onCheckedChange={handleInheritToggle}
            disabled={isUpdating}
            aria-describedby={inheritHelpId}
          />
        </div>
      )}

      {/* Public toggle - disabled when inheriting */}
      <div className={cn(
        "flex items-center justify-between rounded-lg border p-4",
        currentInherit && "opacity-50"
      )}>
        {/* ... existing public toggle UI ... */}
        <Switch
          id={`visibility-${itemId}`}
          checked={currentPublic}
          onCheckedChange={handleToggle}
          disabled={isUpdating || currentInherit}  // Disabled when inheriting
        />
      </div>

      {currentInherit && (
        <p className="text-muted-foreground text-xs italic">
          Visibility is inherited from parent. Disable inheritance to set explicitly.
        </p>
      )}

      {/* ... existing warning dialog ... */}
    </div>
  );
}
```

**Step 2: Add import for setInheritVisibility and Link2 icon**

```typescript
import { setInheritVisibility } from "@/lib/item-actions";
import { Globe, Lock, Loader2, AlertTriangle, Link2 } from "lucide-react";
```

**Step 3: Update callers to pass new props**

Find usages of `<VisibilityToggle>` and add `inheritVisibility` and `hasParent` props.

**Step 4: Commit**

```bash
git add components/items/visibility-toggle.tsx
git commit -m "feat: add inherit visibility toggle to VisibilityToggle component"
```

---

## Task 8: Add Reparenting Warning Dialog

> **Note:** When an item is moved to a different parent, its effective visibility may change if it inherits. Users should be warned.

**Files:**

- Modify: `components/sortable-tree/SortableTree.tsx` (or wherever drag-drop handles reparenting)
- Create: `components/items/reparent-warning-dialog.tsx`
- Test: `tests/unit/components/items/reparent-warning-dialog.test.tsx`

**Step 1: Create warning dialog component**

Create `components/items/reparent-warning-dialog.tsx`:

```typescript
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ReparentWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  oldParentName: string | null;
  newParentName: string | null;
  willBecomePublic: boolean;
  willBecomePrivate: boolean;
  onConfirm: () => void;
}

/**
 * Warning dialog shown when moving an inheriting item to a new parent.
 * Alerts user that visibility will change based on new parent's visibility.
 */
export function ReparentWarningDialog({
  open,
  onOpenChange,
  itemName,
  oldParentName,
  newParentName,
  willBecomePublic,
  willBecomePrivate,
  onConfirm,
}: ReparentWarningDialogProps) {
  const getVisibilityMessage = () => {
    if (willBecomePublic) {
      return `"${itemName}" will become publicly visible because "${newParentName || "the new location"}" is public.`;
    }
    if (willBecomePrivate) {
      return `"${itemName}" will become private because "${newParentName || "the new location"}" is not public.`;
    }
    return `Moving "${itemName}" may affect its visibility.`;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-500" />
            Visibility will change
          </AlertDialogTitle>
          <AlertDialogDescription>
            {getVisibilityMessage()}
            <br />
            <br />
            This item inherits visibility from its parent. Moving it will change
            who can see it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Move anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Write tests**

Create `tests/unit/components/items/reparent-warning-dialog.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ReparentWarningDialog } from "@/components/items/reparent-warning-dialog";

describe("ReparentWarningDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    itemName: "Season 1",
    oldParentName: "Breaking Bad",
    newParentName: "Movies",
    willBecomePublic: false,
    willBecomePrivate: true,
    onConfirm: vi.fn(),
  };

  it("shows warning when item will become private", () => {
    render(<ReparentWarningDialog {...defaultProps} />);

    expect(screen.getByText(/will become private/i)).toBeInTheDocument();
    expect(screen.getByText(/"Movies"/)).toBeInTheDocument();
  });

  it("shows warning when item will become public", () => {
    render(
      <ReparentWarningDialog
        {...defaultProps}
        willBecomePublic={true}
        willBecomePrivate={false}
      />
    );

    expect(screen.getByText(/will become publicly visible/i)).toBeInTheDocument();
  });

  it("calls onConfirm when Move anyway clicked", async () => {
    const onConfirm = vi.fn();
    render(<ReparentWarningDialog {...defaultProps} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: /move anyway/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    const onOpenChange = vi.fn();
    render(<ReparentWarningDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

**Step 3: Integrate into drag-drop handler**

In the component that handles item reparenting (likely `SortableTree.tsx` or similar), add logic to:

1. Check if the moved item has `inheritVisibility: true`
2. Check if old parent's effective visibility differs from new parent's
3. Show `ReparentWarningDialog` if visibility will change
4. Only proceed with move if user confirms

```typescript
// In drag-drop handler
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;

  if (!over || active.id === over.id) return;

  const item = items.find((i) => i.id === active.id);
  const newParent = items.find((i) => i.id === over.id);

  // Check if visibility will change for inheriting items
  if (item?.inheritVisibility) {
    const oldParentPublic = await isItemFullyPublic(item.parentId);
    const newParentPublic = newParent
      ? await isItemFullyPublic(newParent.id)
      : false;

    if (oldParentPublic !== newParentPublic) {
      setPendingMove({ item, newParent, oldParentPublic, newParentPublic });
      setShowReparentWarning(true);
      return; // Wait for dialog confirmation
    }
  }

  // Proceed with move
  await performMove(item, newParent);
};
```

**Step 4: Run tests, commit**

```bash
git add components/items/reparent-warning-dialog.tsx tests/unit/components/items/reparent-warning-dialog.test.tsx
git add components/sortable-tree/SortableTree.tsx
git commit -m "feat: add warning dialog when reparenting changes visibility"
```

---

## Task 9: Add Parent Privacy Warning Dialog

> **Note:** When making a parent private, all inheriting children will also become effectively private. Users should be warned about this cascade effect.

**Files:**

- Create: `components/items/parent-privacy-warning-dialog.tsx`
- Modify: `components/items/visibility-toggle.tsx`
- Test: `tests/unit/components/items/parent-privacy-warning-dialog.test.tsx`

**Step 1: Create helper to count affected children**

Add to `lib/item-actions.ts`:

```typescript
/**
 * Counts children that will be affected by making an item private.
 * Only counts children that inherit visibility (inheritVisibility=true).
 *
 * @param itemId - Parent item ID
 * @returns Count of inheriting children
 */
export async function countInheritingChildren(itemId: string): Promise<number> {
  const count = await prisma.item.count({
    where: {
      parentId: itemId,
      inheritVisibility: true,
    },
  });
  return count;
}
```

**Step 2: Create warning dialog component**

Create `components/items/parent-privacy-warning-dialog.tsx`:

```typescript
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface ParentPrivacyWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  affectedChildCount: number;
  onConfirm: () => void;
}

/**
 * Warning dialog shown when making a parent item private.
 * Alerts user that inheriting children will also become effectively private.
 */
export function ParentPrivacyWarningDialog({
  open,
  onOpenChange,
  itemName,
  affectedChildCount,
  onConfirm,
}: ParentPrivacyWarningDialogProps) {
  const childText = affectedChildCount === 1 ? "1 child item" : `${affectedChildCount} child items`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle aria-hidden="true" className="h-5 w-5 text-amber-500" />
            This will affect child items
          </AlertDialogTitle>
          <AlertDialogDescription>
            Making "{itemName}" private will also hide {childText} that inherit
            visibility from it.
            <br />
            <br />
            These items will no longer be accessible to others until you make
            this item public again or change their visibility settings individually.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Make private
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 3: Write tests**

Create `tests/unit/components/items/parent-privacy-warning-dialog.test.tsx`:

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ParentPrivacyWarningDialog } from "@/components/items/parent-privacy-warning-dialog";

describe("ParentPrivacyWarningDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    itemName: "Breaking Bad",
    affectedChildCount: 5,
    onConfirm: vi.fn(),
  };

  it("shows count of affected children", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(screen.getByText(/5 child items/)).toBeInTheDocument();
  });

  it("uses singular form for 1 child", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} affectedChildCount={1} />);

    expect(screen.getByText(/1 child item/)).toBeInTheDocument();
  });

  it("shows item name in message", () => {
    render(<ParentPrivacyWarningDialog {...defaultProps} />);

    expect(screen.getByText(/"Breaking Bad"/)).toBeInTheDocument();
  });

  it("calls onConfirm when Make private clicked", async () => {
    const onConfirm = vi.fn();
    render(<ParentPrivacyWarningDialog {...defaultProps} onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole("button", { name: /make private/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it("calls onOpenChange when Cancel clicked", async () => {
    const onOpenChange = vi.fn();
    render(<ParentPrivacyWarningDialog {...defaultProps} onOpenChange={onOpenChange} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

**Step 4: Integrate into VisibilityToggle**

Update `components/items/visibility-toggle.tsx` to show warning when making public item private:

```typescript
import { ParentPrivacyWarningDialog } from "./parent-privacy-warning-dialog";
import { countInheritingChildren } from "@/lib/item-actions";

// Inside component:
const [showPrivacyWarning, setShowPrivacyWarning] = useState(false);
const [affectedChildCount, setAffectedChildCount] = useState(0);

const handleToggle = async (checked: boolean) => {
  // If making item private and it might have inheriting children
  if (!checked && currentPublic && hasChildren) {
    const count = await countInheritingChildren(itemId);
    if (count > 0) {
      setAffectedChildCount(count);
      setShowPrivacyWarning(true);
      return; // Wait for dialog confirmation
    }
  }

  // Proceed with toggle
  await performVisibilityToggle(checked);
};

const handlePrivacyConfirm = async () => {
  setShowPrivacyWarning(false);
  await performVisibilityToggle(false);
};

// In render:
<ParentPrivacyWarningDialog
  open={showPrivacyWarning}
  onOpenChange={setShowPrivacyWarning}
  itemName={itemName}
  affectedChildCount={affectedChildCount}
  onConfirm={handlePrivacyConfirm}
/>
```

**Step 5: Add itemName prop to VisibilityToggle**

Update interface:

```typescript
interface VisibilityToggleProps {
  itemId: string;
  itemName: string; // Add this
  isPublic: boolean;
  inheritVisibility: boolean;
  hasParent: boolean;
  hasChildren?: boolean;
  // ...
}
```

**Step 6: Run tests, commit**

```bash
git add components/items/parent-privacy-warning-dialog.tsx
git add tests/unit/components/items/parent-privacy-warning-dialog.test.tsx
git add components/items/visibility-toggle.tsx lib/item-actions.ts
git commit -m "feat: add warning dialog when making parent private"
```

---

## Task 10: Update Seed Configuration

**Files:**

- Modify: `prisma/seed-config.ts`
- Modify: `prisma/seed.ts`

**Step 1: Update seed to set proper visibility**

In `prisma/seed.ts`, for movie and TV show creation:

```typescript
// Movies: explicitly public, don't inherit
const item = await prisma.item.create({
  data: {
    name,
    description: description || null,
    userId,
    parentId,
    order: startOrder + i,
    depth: baseDepth,
    isPublic: true, // Explicitly public
    inheritVisibility: false, // Don't inherit
    // ... other fields
  },
});
```

For seasons and episodes:

```typescript
// Seasons/Episodes: inherit from parent
const season = await prisma.item.create({
  data: {
    name: seasonName,
    userId,
    parentId: showItem.id,
    order: seasonIndex,
    depth: baseDepth + 1,
    isPublic: false, // Not explicitly public
    inheritVisibility: true, // Inherit from show
    // ... other fields
  },
});
```

For parent folders (Movies, TV Shows):

```typescript
// Parent folders: private, don't inherit
const folder = await prisma.item.create({
  data: {
    name: "Movies",
    userId,
    parentId: null,
    order: 0,
    depth: 0,
    isPublic: false, // Not public
    inheritVisibility: false, // Can't inherit (root)
    // ... other fields
  },
});
```

**Step 2: Run seed to test**

Run: `ALLOW_SEEDING=true SEED_SKIP_DRIVE=true npx prisma db seed`
Expected: Seed completes

**Step 3: Verify Explore shows only movies/shows**

Check database:

```sql
SELECT name, "isPublic", "inheritVisibility" FROM "Item" WHERE "isPublic" = true LIMIT 20;
```

Expected: Only movies and TV shows, not folders or episodes

**Step 4: Commit**

```bash
git add prisma/seed.ts prisma/seed-config.ts
git commit -m "feat: update seed for inherited visibility model"
```

---

## Task 11: Update Fork Logic (CR-3)

**Files:**

- Modify: `lib/fork-actions.ts`
- Test: `tests/unit/lib/fork-actions.test.ts`

**Step 1: Write failing test**

Add to `tests/unit/lib/fork-actions.test.ts`:

```typescript
it("creates forked item with inheritVisibility=false", async () => {
  // ... setup mocks

  await forkItem("source-id", "target-parent-id");

  expect(mockItemCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        inheritVisibility: false, // Forked items should not inherit
        isPublic: false, // Forked items start private
      }),
    })
  );
});
```

**Step 2: Update forkItem**

In `lib/fork-actions.ts`, ensure forked items have `inheritVisibility: false`:

```typescript
const forkedItem = await prisma.item.create({
  data: {
    name: sourceItem.name,
    description: sourceItem.description,
    userId: session.user.id,
    parentId: targetParentId,
    order: maxOrder + 1,
    depth: targetDepth,
    isPublic: false, // Forked items start private
    inheritVisibility: false, // Forked items use explicit visibility
    // ... other fields
  },
});
```

**Step 3: Run tests, commit**

```bash
git add lib/fork-actions.ts tests/unit/lib/fork-actions.test.ts
git commit -m "feat: ensure forked items have explicit visibility"
```

---

## Task 12: Update Integration Tests

**Files:**

- Modify: `tests/integration/public/public-profile.test.ts`

**Step 1: Update existing tests**

Update `describe("public item visibility")` tests to account for inheritance:

```typescript
it("returns true for item inheriting from public ancestor", async () => {
  const { user } = await createTestUser("inherit-public");

  try {
    // Create public parent (explicit)
    const parent = await prisma.item.create({
      data: {
        userId: user.id,
        name: "Public Parent",
        isPublic: true,
        inheritVisibility: false,
        order: 0,
        depth: 0,
      },
    });

    // Create inheriting child
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

    const isFullyPublic = await isItemFullyPublic(child.id);
    expect(isFullyPublic).toBe(true);
  } finally {
    await cleanupUser(user.id);
  }
});

it("returns false when inherit chain breaks at private explicit item", async () => {
  const { user } = await createTestUser("broken-chain");

  try {
    // Public grandparent
    const grandparent = await prisma.item.create({
      data: {
        userId: user.id,
        name: "Public Grandparent",
        isPublic: true,
        inheritVisibility: false,
        order: 0,
        depth: 0,
      },
    });

    // Private parent (explicit - breaks chain)
    const parent = await prisma.item.create({
      data: {
        userId: user.id,
        name: "Private Parent",
        isPublic: false,
        inheritVisibility: false, // Explicit private
        parentId: grandparent.id,
        order: 0,
        depth: 1,
      },
    });

    // Inheriting child
    const child = await prisma.item.create({
      data: {
        userId: user.id,
        name: "Inheriting Child",
        isPublic: false,
        inheritVisibility: true,
        parentId: parent.id,
        order: 0,
        depth: 2,
      },
    });

    const isFullyPublic = await isItemFullyPublic(child.id);
    expect(isFullyPublic).toBe(false); // Chain broken by explicit private parent
  } finally {
    await cleanupUser(user.id);
  }
});
```

**Step 2: Add integration test for recursive CTE (CR-8)**

```typescript
it("correctly resolves deep inheritance chain via raw SQL", async () => {
  const { user } = await createTestUser("deep-chain");

  try {
    // Create 5-level deep hierarchy: public root -> inherit -> inherit -> inherit -> inherit
    const root = await prisma.item.create({
      data: {
        userId: user.id,
        name: "Level 0",
        isPublic: true,
        inheritVisibility: false,
        order: 0,
        depth: 0,
      },
    });

    let parentId = root.id;
    let lastChild;
    for (let i = 1; i <= 4; i++) {
      lastChild = await prisma.item.create({
        data: {
          userId: user.id,
          name: `Level ${i}`,
          isPublic: false,
          inheritVisibility: true,
          parentId,
          order: 0,
          depth: i,
        },
      });
      parentId = lastChild.id;
    }

    // Deepest child should inherit public from root
    const isFullyPublic = await isItemFullyPublic(lastChild!.id);
    expect(isFullyPublic).toBe(true);
  } finally {
    await cleanupUser(user.id);
  }
});
```

**Step 3: Run integration tests**

Run: `pnpm run test:integration tests/integration/public/`
Expected: All tests pass

**Step 4: Commit**

```bash
git add tests/integration/public/public-profile.test.ts
git commit -m "test: update integration tests for inherited visibility"
```

---

## Task 13: Update E2E Tests

**Files:**

- Modify: `e2e/journeys/public/explore.spec.ts`
- Modify: `e2e/journeys/public/public-profile.spec.ts`

**Step 1: Update explore E2E tests**

In `explore.spec.ts`, ensure test items are explicitly public:

```typescript
// Create a public item (explicit, not inheriting)
const item = await prisma.item.create({
  data: {
    name: "Public Explore Collection",
    description: "A test collection for explore E2E testing",
    userId: ownerId,
    depth: 0,
    order: 0,
    isPublic: true,
    inheritVisibility: false, // Explicit
  },
});
```

**Step 2: Add E2E test for inherited item access**

Add to `public-profile.spec.ts`:

```typescript
test("can access inheriting child via direct link", async ({
  page,
  publicProfilePage,
}) => {
  // Create parent (explicit public) and child (inheriting)
  const parent = await prisma.item.create({
    data: {
      name: "Public Show",
      userId: ownerId,
      depth: 0,
      order: 0,
      isPublic: true,
      inheritVisibility: false,
    },
  });

  const child = await prisma.item.create({
    data: {
      name: "Season 1",
      userId: ownerId,
      parentId: parent.id,
      depth: 1,
      order: 0,
      isPublic: false,
      inheritVisibility: true,
    },
  });

  // Direct link to child should work
  await page.goto(`/u/${ownerUsername}/${child.id}`);
  await publicProfilePage.expectHeroVisible("Season 1");
});

test("inheriting child not shown on Explore", async ({
  page,
  publicProfilePage,
}) => {
  // Child inherits but shouldn't appear in Explore
  await publicProfilePage.gotoExplore();

  // Should see parent but not child
  await expect(page.getByText("Public Show").first()).toBeVisible();
  await expect(page.getByText("Season 1")).not.toBeVisible();
});
```

**Step 3: Run E2E tests**

Run: `pnpm run test:e2e e2e/journeys/public/`
Expected: All tests pass

**Step 4: Commit**

```bash
git add e2e/journeys/public/
git commit -m "test: update E2E tests for inherited visibility"
```

---

## Task 14: Update Types

**Files:**

- Modify: `lib/types.ts`

**Step 1: Add inheritVisibility to Item type if needed**

Check if `lib/types.ts` has an Item type that needs updating. Add `inheritVisibility: boolean` if present.

**Step 2: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add inheritVisibility to Item type"
```

---

## Task 15: Run Full Test Suite

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run all tests**

Run: `pnpm run test`
Expected: All unit tests pass

Run: `pnpm run test:integration`
Expected: All integration tests pass

Run: `pnpm run test:e2e`
Expected: All E2E tests pass

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: inherited visibility feature complete"
```

---

## Summary of Test Changes

### Unit Tests (`tests/unit/lib/public-auth.test.ts`)

- **Add:** Tests for inheritance in `isItemFullyPublic`
- **Add:** Tests for inheritance in `getPublicChildItems`
- **Update:** `getExploreItems` tests to verify `inheritVisibility: false` filter
- **Update:** `getPublicItemsForUser` tests for explicit visibility

### Unit Tests (`tests/unit/lib/item-actions.test.ts`)

- **Add:** Full test suite for `setInheritVisibility`
- **Add:** Tests for `countInheritingChildren`

### Unit Tests (`tests/unit/lib/fork-actions.test.ts`)

- **Add:** Test for `inheritVisibility: false` on forked items

### Unit Tests (New Dialog Components)

- **Add:** `tests/unit/components/items/reparent-warning-dialog.test.tsx`
- **Add:** `tests/unit/components/items/parent-privacy-warning-dialog.test.tsx`

### Integration Tests (`tests/integration/public/public-profile.test.ts`)

- **Update:** `isItemFullyPublic` tests with inheritance scenarios
- **Add:** Tests for broken inheritance chains
- **Add:** Test for deep inheritance chain (CR-8)
- **Update:** `getPublicChildItems` tests for inheriting children

### E2E Tests (`e2e/journeys/public/explore.spec.ts`)

- **Update:** Test items created with `inheritVisibility: false`
- **Add:** Test that inheriting items don't appear on Explore

### E2E Tests (`e2e/journeys/public/public-profile.spec.ts`)

- **Add:** Test for direct link access to inheriting child
- **Add:** Test for drill-down navigation through inheriting items

---

## Execution Choice

Plan complete and saved to `docs/plans/2026-01-20-inherited-item-visibility.md`.

**Two execution options:**

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
