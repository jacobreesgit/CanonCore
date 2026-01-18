# Continue Watching (DFS-Based) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Go to [ItemName]" button that navigates to the first incomplete item in DFS order across item hierarchies.

**Architecture:** Server action `getFirstIncompleteItem()` traverses descendants via recursive CTE and returns the first item with incomplete primary media (< 90%). The hero component reuses the existing button style, showing either one button (when current has no media) or two identical-style buttons (when current has media).

**Tech Stack:** TypeScript, Prisma raw SQL (recursive CTE), React Server Components, Next.js Server Actions

---

## Feature Requirements

1. **Item with NO media but HAS children with media:** Show "Go to [ItemName]" button for first incomplete descendant (DFS order)
2. **Item with media:** Show "Resume/Play" button (left) + "Go to [ItemName]" button (right) - **same button style**
3. **My Items root page:** Show "Go to [ItemName]" button for first incomplete item in entire library

## Key Definitions

- **Incomplete item:** Has primary media file with `playbackPosition < playbackDuration * 0.9`
- **DFS order:** Depth-first search visiting children by `order` field, descending into each child before siblings
- **Primary media:** The file marked `isPrimary=true` with `fileType=MEDIA` (items without explicit primary media are not considered)

---

## Task 1: Add NextItem Type

**Files:**

- Modify: `lib/types.ts:403`

**Step 1: Write the type definition**

Add after line 403 (after `isValidViewMode` function):

```typescript
/**
 * Minimal item data for "Go to" button display.
 * Returned by getFirstIncompleteItem() server action.
 */
export interface NextItem {
  /** Item ID for navigation */
  id: string;
  /** Item name for button label ("Go to [name]") */
  name: string;
}
```

**Step 2: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "$(cat <<'EOF'
feat: add NextItem type for go-to navigation feature
EOF
)"
```

---

## Task 2: Add findFirstIncompleteItem Utility

**Files:**

- Modify: `lib/progress-utils.ts:113`
- Test: `tests/unit/lib/progress-utils.test.ts`

**Step 1: Write the failing test**

Add to `tests/unit/lib/progress-utils.test.ts`:

```typescript
import {
  isFileComplete,
  calculateProgress,
  formatProgressLabel,
  findFirstIncompleteItem,
  COMPLETION_THRESHOLD,
  type ItemProgress,
} from "@/lib/progress-utils";

// ... existing tests ...

describe("findFirstIncompleteItem", () => {
  it("returns null for empty array", () => {
    const result = findFirstIncompleteItem([]);
    expect(result).toBeNull();
  });

  it("returns null when all items are complete", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 95,
        duration: 100,
      },
      {
        id: "2",
        order: 1,
        parentId: null,
        hasPrimaryMedia: true,
        position: 100,
        duration: 100,
      },
    ];
    expect(findFirstIncompleteItem(items)).toBeNull();
  });

  it("returns null when no items have media", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: false,
        position: null,
        duration: null,
      },
    ];
    expect(findFirstIncompleteItem(items)).toBeNull();
  });

  it("returns first incomplete item in order", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 95,
        duration: 100,
      }, // complete
      {
        id: "2",
        order: 1,
        parentId: null,
        hasPrimaryMedia: true,
        position: 50,
        duration: 100,
      }, // incomplete
      {
        id: "3",
        order: 2,
        parentId: null,
        hasPrimaryMedia: true,
        position: 30,
        duration: 100,
      }, // incomplete
    ];
    expect(findFirstIncompleteItem(items)).toBe("2");
  });

  it("follows DFS order - visits children before siblings", () => {
    // Tree structure:
    // 1 (order 0, complete)
    //   ├─ 1a (order 0, complete)
    //   └─ 1b (order 1, incomplete) <- should be found
    // 2 (order 1, incomplete) <- NOT this one
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 95,
        duration: 100,
      },
      {
        id: "1a",
        order: 0,
        parentId: "1",
        hasPrimaryMedia: true,
        position: 95,
        duration: 100,
      },
      {
        id: "1b",
        order: 1,
        parentId: "1",
        hasPrimaryMedia: true,
        position: 50,
        duration: 100,
      },
      {
        id: "2",
        order: 1,
        parentId: null,
        hasPrimaryMedia: true,
        position: 50,
        duration: 100,
      },
    ];
    expect(findFirstIncompleteItem(items)).toBe("1b");
  });

  it("skips items without media in DFS traversal", () => {
    // Tree: folder -> incomplete child
    const items = [
      {
        id: "folder",
        order: 0,
        parentId: null,
        hasPrimaryMedia: false,
        position: null,
        duration: null,
      },
      {
        id: "child",
        order: 0,
        parentId: "folder",
        hasPrimaryMedia: true,
        position: 50,
        duration: 100,
      },
    ];
    expect(findFirstIncompleteItem(items)).toBe("child");
  });

  it("treats null position as incomplete (not started)", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: null,
        duration: 100,
      },
    ];
    expect(findFirstIncompleteItem(items)).toBe("1");
  });

  it("treats zero position as incomplete", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 0,
        duration: 100,
      },
    ];
    expect(findFirstIncompleteItem(items)).toBe("1");
  });

  it("respects order field for sibling ordering", () => {
    const items = [
      {
        id: "b",
        order: 1,
        parentId: null,
        hasPrimaryMedia: true,
        position: 50,
        duration: 100,
      },
      {
        id: "a",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 50,
        duration: 100,
      },
    ];
    // Should return "a" because it has order 0, even though "b" appears first in array
    expect(findFirstIncompleteItem(items)).toBe("a");
  });

  it("treats exactly 90% position as complete (threshold boundary)", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 90,
        duration: 100,
      },
    ];
    // 90 >= 100 * 0.9 → 90 >= 90 → TRUE (complete)
    expect(findFirstIncompleteItem(items)).toBeNull();
  });

  it("treats just below 90% as incomplete (threshold boundary)", () => {
    const items = [
      {
        id: "1",
        order: 0,
        parentId: null,
        hasPrimaryMedia: true,
        position: 89.9,
        duration: 100,
      },
    ];
    // 89.9 >= 100 * 0.9 → 89.9 >= 90 → FALSE (incomplete)
    expect(findFirstIncompleteItem(items)).toBe("1");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm run test:unit tests/unit/lib/progress-utils.test.ts
```

Expected: FAIL - `findFirstIncompleteItem` is not exported

**Step 3: Write the implementation**

Add to `lib/progress-utils.ts` after `formatProgressLabel`:

```typescript
/**
 * Input type for findFirstIncompleteItem.
 * Minimal data needed for DFS traversal and completion check.
 */
export interface IncompleteItemInput {
  id: string;
  order: number;
  parentId: string | null;
  hasPrimaryMedia: boolean;
  position: number | null;
  duration: number | null;
}

/**
 * Finds the first incomplete item in DFS order.
 * An item is incomplete if it has primary media that is < 90% watched.
 * Items without media are skipped but their children are still traversed.
 *
 * @param items - Flat array of items with order, parentId, and media info
 * @returns ID of first incomplete item, or null if all complete/no media
 */
export function findFirstIncompleteItem(
  items: IncompleteItemInput[]
): string | null {
  if (items.length === 0) return null;

  // Build parent -> children map
  const childrenMap = new Map<string | null, IncompleteItemInput[]>();
  for (const item of items) {
    const siblings = childrenMap.get(item.parentId) ?? [];
    siblings.push(item);
    childrenMap.set(item.parentId, siblings);
  }

  // Sort children by order at each level
  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.order - b.order);
  }

  // DFS traversal
  function traverse(parentId: string | null): string | null {
    const children = childrenMap.get(parentId) ?? [];

    for (const item of children) {
      // Check if this item is incomplete
      if (
        item.hasPrimaryMedia &&
        !isFileComplete(item.position, item.duration)
      ) {
        return item.id;
      }

      // Recurse into children (DFS - depth first)
      const found = traverse(item.id);
      if (found) return found;
    }

    return null;
  }

  return traverse(null);
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm run test:unit tests/unit/lib/progress-utils.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/progress-utils.ts tests/unit/lib/progress-utils.test.ts
git commit -m "$(cat <<'EOF'
feat: add findFirstIncompleteItem utility for DFS traversal
EOF
)"
```

---

## Task 3: Add getFirstIncompleteItem Server Action

**Files:**

- Modify: `lib/item-actions.ts`
- Test: `tests/integration/items/item-progress.test.ts`

**Step 1: Write the failing integration test**

Add to `tests/integration/items/item-progress.test.ts`:

```typescript
import { getFirstIncompleteItem } from "@/lib/item-actions";

// ... existing tests ...

describe("getFirstIncompleteItem", () => {
  it("returns null for user with no items", async () => {
    const result = await getFirstIncompleteItem();
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("returns null when all items are complete", async () => {
    // Create item with complete primary media
    const item = await prisma.item.create({
      data: {
        name: "Complete",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });
    await prisma.itemFile.create({
      data: {
        itemId: item.id,
        filename: "video.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 95,
        playbackDuration: 100,
      },
    });

    const result = await getFirstIncompleteItem();
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("returns first incomplete item in library", async () => {
    // Create complete item
    const complete = await prisma.item.create({
      data: {
        name: "Complete",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });
    await prisma.itemFile.create({
      data: {
        itemId: complete.id,
        filename: "video.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 95,
        playbackDuration: 100,
      },
    });

    // Create incomplete item
    const incomplete = await prisma.item.create({
      data: {
        name: "Incomplete",
        userId: testUser.id,
        order: 1,
        depth: 0,
      },
    });
    await prisma.itemFile.create({
      data: {
        itemId: incomplete.id,
        filename: "movie.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 50,
        playbackDuration: 100,
      },
    });

    const result = await getFirstIncompleteItem();
    expect(result.success).toBe(true);
    expect(result.data).not.toBeNull();
    expect(result.data?.id).toBe(incomplete.id);
    expect(result.data?.name).toBe("Incomplete");
  });

  it("follows DFS order for nested items", async () => {
    // Create parent folder
    const parent = await prisma.item.create({
      data: {
        name: "Movies",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    // Create complete child
    const completeChild = await prisma.item.create({
      data: {
        name: "Complete Movie",
        parentId: parent.id,
        userId: testUser.id,
        order: 0,
        depth: 1,
      },
    });
    await prisma.itemFile.create({
      data: {
        itemId: completeChild.id,
        filename: "complete.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 95,
        playbackDuration: 100,
      },
    });

    // Create incomplete child (should be found)
    const incompleteChild = await prisma.item.create({
      data: {
        name: "Incomplete Movie",
        parentId: parent.id,
        userId: testUser.id,
        order: 1,
        depth: 1,
      },
    });
    await prisma.itemFile.create({
      data: {
        itemId: incompleteChild.id,
        filename: "incomplete.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 50,
        playbackDuration: 100,
      },
    });

    // Create root-level incomplete (should NOT be found - DFS goes into Movies first)
    const rootIncomplete = await prisma.item.create({
      data: {
        name: "Root Incomplete",
        userId: testUser.id,
        order: 1,
        depth: 0,
      },
    });
    await prisma.itemFile.create({
      data: {
        itemId: rootIncomplete.id,
        filename: "root.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 30,
        playbackDuration: 100,
      },
    });

    const result = await getFirstIncompleteItem();
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(incompleteChild.id);
  });

  describe("with parentId filter", () => {
    it("returns first incomplete descendant of specified parent", async () => {
      // Create two parent folders
      const folder1 = await prisma.item.create({
        data: { name: "Folder 1", userId: testUser.id, order: 0, depth: 0 },
      });
      const folder2 = await prisma.item.create({
        data: { name: "Folder 2", userId: testUser.id, order: 1, depth: 0 },
      });

      // Incomplete in folder1
      const child1 = await prisma.item.create({
        data: {
          name: "Child 1",
          parentId: folder1.id,
          userId: testUser.id,
          order: 0,
          depth: 1,
        },
      });
      await prisma.itemFile.create({
        data: {
          itemId: child1.id,
          filename: "v1.mp4",
          fileType: "MEDIA",
          isPrimary: true,
          playbackPosition: 50,
          playbackDuration: 100,
        },
      });

      // Incomplete in folder2
      const child2 = await prisma.item.create({
        data: {
          name: "Child 2",
          parentId: folder2.id,
          userId: testUser.id,
          order: 0,
          depth: 1,
        },
      });
      await prisma.itemFile.create({
        data: {
          itemId: child2.id,
          filename: "v2.mp4",
          fileType: "MEDIA",
          isPrimary: true,
          playbackPosition: 30,
          playbackDuration: 100,
        },
      });

      // Query for folder2's descendants only
      const result = await getFirstIncompleteItem(folder2.id);
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe(child2.id);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm run test:integration tests/integration/items/item-progress.test.ts
```

Expected: FAIL - `getFirstIncompleteItem` is not exported

**Step 3: Write the implementation**

Add to `lib/item-actions.ts`:

```typescript
import type { NextItem } from "./types";
import { findFirstIncompleteItem } from "./progress-utils";

/**
 * Gets the first incomplete item in DFS order.
 * Used for "Go to" button on My Items and item detail pages.
 *
 * @param parentId - Optional parent ID to search within (null = entire library)
 * @returns First incomplete item data or null if all complete
 */
export async function getFirstIncompleteItem(
  parentId?: string | null
): Promise<ItemResult<NextItem | null>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  try {
    // Query all items with their primary media progress
    // Uses recursive CTE if parentId specified, otherwise fetches all
    const itemsWithProgress = parentId
      ? await prisma.$queryRaw<
          {
            id: string;
            name: string;
            order: number;
            parentId: string | null;
            hasPrimaryMedia: boolean;
            position: number | null;
            duration: number | null;
          }[]
        >`
          WITH RECURSIVE descendants AS (
            SELECT id FROM "Item" WHERE "parentId" = ${parentId} AND "userId" = ${session.user.id}
            UNION ALL
            SELECT i.id FROM "Item" i
            INNER JOIN descendants d ON i."parentId" = d.id
            WHERE i."userId" = ${session.user.id}
          )
          SELECT
            i.id,
            i.name,
            i."order",
            i."parentId",
            EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true) as "hasPrimaryMedia",
            (SELECT f."playbackPosition" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true LIMIT 1) as "position",
            (SELECT f."playbackDuration" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true LIMIT 1) as "duration"
          FROM "Item" i
          WHERE i.id IN (SELECT id FROM descendants)
          ORDER BY i."order"
        `
      : await prisma.$queryRaw<
          {
            id: string;
            name: string;
            order: number;
            parentId: string | null;
            hasPrimaryMedia: boolean;
            position: number | null;
            duration: number | null;
          }[]
        >`
          SELECT
            i.id,
            i.name,
            i."order",
            i."parentId",
            EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true) as "hasPrimaryMedia",
            (SELECT f."playbackPosition" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true LIMIT 1) as "position",
            (SELECT f."playbackDuration" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' AND f."isPrimary" = true LIMIT 1) as "duration"
          FROM "Item" i
          WHERE i."userId" = ${session.user.id}
          ORDER BY i."order"
        `;

    // Find first incomplete using utility function
    const incompleteId = findFirstIncompleteItem(
      itemsWithProgress.map((item) => ({
        id: item.id,
        order: item.order,
        parentId: item.parentId,
        hasPrimaryMedia: item.hasPrimaryMedia,
        position: item.position,
        duration: item.duration,
      }))
    );

    if (!incompleteId) {
      return { success: true, data: null };
    }

    // Get full data for the incomplete item
    const incompleteItem = itemsWithProgress.find((i) => i.id === incompleteId);
    if (!incompleteItem) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: incompleteItem.id,
        name: incompleteItem.name,
      },
    };
  } catch (error) {
    logger.error({ error }, "Failed to get first incomplete item");
    return { error: "Failed to get next item" };
  }
}
```

**Step 4: Run integration test**

```bash
pnpm run test:integration tests/integration/items/item-progress.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/integration/items/item-progress.test.ts
git commit -m "$(cat <<'EOF'
feat: add getFirstIncompleteItem server action
EOF
)"
```

---

## Task 4: Update ItemHero to Support "Go to" Button

**Files:**

- Modify: `components/items/item-hero.tsx`
- Test: `tests/unit/components/items/item-hero.test.tsx`

**Step 1: Write the failing test**

Add to `tests/unit/components/items/item-hero.test.tsx`:

```typescript
import { NextItem } from "@/lib/types";

describe("ItemHero go-to button", () => {
  const mockNextItem: NextItem = {
    id: "next-123",
    name: "Breaking Bad S01E02",
  };

  it("shows Go to button when no media but nextItem provided", () => {
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        nextItem={mockNextItem}
        onGoToNext={vi.fn()}
      />
    );

    expect(screen.getByTestId("item-hero-goto")).toBeInTheDocument();
    expect(screen.getByTestId("item-hero-goto")).toHaveTextContent(
      "Go to Breaking Bad S01E02"
    );
    expect(screen.queryByTestId("item-hero-play")).not.toBeInTheDocument();
  });

  it("shows both Resume and Go to buttons when has media and nextItem", () => {
    render(
      <ItemHero
        name="Movie"
        hasMedia={true}
        hasProgress={true}
        primaryMediaName="movie.mp4"
        onPlay={vi.fn()}
        nextItem={mockNextItem}
        onGoToNext={vi.fn()}
      />
    );

    expect(screen.getByTestId("item-hero-play")).toBeInTheDocument();
    expect(screen.getByTestId("item-hero-goto")).toBeInTheDocument();
  });

  it("both buttons use same glass variant style", () => {
    render(
      <ItemHero
        name="Movie"
        hasMedia={true}
        onPlay={vi.fn()}
        nextItem={mockNextItem}
        onGoToNext={vi.fn()}
      />
    );

    const playButton = screen.getByTestId("item-hero-play");
    const gotoButton = screen.getByTestId("item-hero-goto");

    // Both should have glass variant (same style)
    expect(playButton.className).toContain("glass");
    expect(gotoButton.className).toContain("glass");
  });

  it("calls onGoToNext when Go to button clicked", async () => {
    const onGoToNext = vi.fn();
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        nextItem={mockNextItem}
        onGoToNext={onGoToNext}
      />
    );

    await userEvent.click(screen.getByTestId("item-hero-goto"));
    expect(onGoToNext).toHaveBeenCalledWith(mockNextItem);
  });

  it("does not show Go to button without onGoToNext callback", () => {
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        nextItem={mockNextItem}
      />
    );

    expect(screen.queryByTestId("item-hero-goto")).not.toBeInTheDocument();
  });

  it("does not show Go to button when nextItem is null", () => {
    render(
      <ItemHero
        name="Movie"
        hasMedia={true}
        onPlay={vi.fn()}
        nextItem={null}
        onGoToNext={vi.fn()}
      />
    );

    expect(screen.queryByTestId("item-hero-goto")).not.toBeInTheDocument();
  });

  it("shows full item name in title attribute for tooltip on hover", () => {
    const longNameItem: NextItem = {
      id: "long-123",
      name: "Breaking Bad - Season 1 - Episode 2 - Cat's in the Bag...",
    };
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        nextItem={longNameItem}
        onGoToNext={vi.fn()}
      />
    );

    const gotoButton = screen.getByTestId("item-hero-goto");
    expect(gotoButton).toHaveAttribute(
      "title",
      "Go to Breaking Bad - Season 1 - Episode 2 - Cat's in the Bag..."
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm run test:unit tests/unit/components/items/item-hero.test.tsx
```

Expected: FAIL - `nextItem` and `onGoToNext` props not defined

**Step 3: Update ItemHero component**

Modify `components/items/item-hero.tsx`:

```typescript
import type { NextItem } from "@/lib/types";
import { Play, ChevronDown, ChevronUp, Maximize2, ArrowRight } from "lucide-react";

interface ItemHeroProps {
  // ... existing props ...
  /** Next incomplete item to navigate to (first incomplete descendant). */
  nextItem?: NextItem | null;
  /** Callback when "Go to" button clicked. */
  onGoToNext?: (item: NextItem) => void;
}

export function ItemHero({
  // ... existing props ...
  nextItem,
  onGoToNext,
}: ItemHeroProps) {
  // ... existing logic ...

  // Show go-to button when nextItem exists AND onGoToNext callback exists
  const showGoTo = nextItem && onGoToNext;

  return (
    <motion.section /* ... */>
      {isCollapsedState ? (
        // Collapsed content - horizontal bar
        <motion.div /* ... */>
          {/* ... name ... */}
          <div className="flex items-center gap-2">
            {hasMedia && onPlay && (
              <Button
                size="sm"
                variant="glass"
                onClick={onPlay}
                className="max-w-[200px] gap-2"
                data-testid="item-hero-play"
              >
                <Play className="size-4 shrink-0" />
                <span className="truncate">
                  {hasProgress ? "Resume" : "Play"}
                  {primaryMediaName && ` ${primaryMediaName}`}
                </span>
              </Button>
            )}
            {showGoTo && (
              <Button
                size="sm"
                variant="glass"
                onClick={() => onGoToNext(nextItem)}
                className="max-w-[200px] gap-2"
                title={`Go to ${nextItem.name}`}
                data-testid="item-hero-goto"
              >
                <ArrowRight className="size-4 shrink-0" />
                <span className="truncate">Go to {nextItem.name}</span>
              </Button>
            )}
            {/* collapse button */}
          </div>
        </motion.div>
      ) : (
        // Expanded content - full cinematic hero
        <motion.div /* ... */>
          {/* ... title, description, progress ... */}

          {/* Button row - flex container for both buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Play button with primary media name in label */}
            {hasMedia && onPlay && (
              <Button
                size="lg"
                variant="glass"
                onClick={onPlay}
                className="max-w-xs gap-2"
                data-testid="item-hero-play"
              >
                <Play className="size-5 shrink-0" />
                <span className="truncate">
                  {hasProgress ? "Resume" : "Play"}
                  {primaryMediaName && ` ${primaryMediaName}`}
                </span>
              </Button>
            )}

            {/* Go to button for first incomplete descendant - same style as play button */}
            {showGoTo && (
              <Button
                size="lg"
                variant="glass"
                onClick={() => onGoToNext(nextItem)}
                className="max-w-xs gap-2"
                title={`Go to ${nextItem.name}`}
                data-testid="item-hero-goto"
              >
                <ArrowRight className="size-5 shrink-0" />
                <span className="truncate">Go to {nextItem.name}</span>
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
```

**Step 4: Run test**

```bash
pnpm run test:unit tests/unit/components/items/item-hero.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add components/items/item-hero.tsx tests/unit/components/items/item-hero.test.tsx
git commit -m "$(cat <<'EOF'
feat: add go-to button support to ItemHero component
EOF
)"
```

---

## Task 5: Wire Up ItemDetailClient with Go To Button

**Files:**

- Create: `hooks/use-goto-item.ts`
- Modify: `components/items/item-detail-client.tsx`
- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`
- Test: `tests/unit/components/items/item-detail-client.test.tsx`
- Test: `tests/unit/hooks/use-goto-item.test.ts`

**Step 1: Create shared navigation hook**

Create `hooks/use-goto-item.ts`:

```typescript
/**
 * Hook for navigating to items via "Go to" button.
 * Shared between ItemDetailClient and ItemsView to avoid duplication.
 */

"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { NextItem } from "@/lib/types";

/**
 * Returns a memoized callback for navigating to an item.
 * Used by "Go to [ItemName]" buttons in hero components.
 *
 * @returns Callback that navigates to /my-items/{item.id}
 */
export function useGoToItem() {
  const router = useRouter();

  return useCallback(
    (item: NextItem) => {
      router.push(`/my-items/${item.id}`);
    },
    [router]
  );
}
```

**Step 2: Write hook unit test**

Create `tests/unit/hooks/use-goto-item.test.ts`:

```typescript
import { renderHook } from "@testing-library/react";
import { useGoToItem } from "@/hooks/use-goto-item";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("useGoToItem", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("returns a stable callback", () => {
    const { result, rerender } = renderHook(() => useGoToItem());
    const firstCallback = result.current;

    rerender();
    const secondCallback = result.current;

    expect(firstCallback).toBe(secondCallback);
  });

  it("navigates to correct URL when called", () => {
    const { result } = renderHook(() => useGoToItem());

    result.current({ id: "item-123", name: "Test Item" });

    expect(mockPush).toHaveBeenCalledWith("/my-items/item-123");
  });

  it("uses item.id for navigation, not name", () => {
    const { result } = renderHook(() => useGoToItem());

    result.current({ id: "abc", name: "Different Name" });

    expect(mockPush).toHaveBeenCalledWith("/my-items/abc");
  });
});
```

**Step 3: Update the page to fetch nextItem**

Modify `app/(my-items)/my-items/[itemId]/page.tsx` to fetch and pass nextItem:

```typescript
import { getFirstIncompleteItem } from "@/lib/item-actions";

export default async function ItemDetailPage({ params }: Props) {
  // ... existing fetches ...

  // Fetch next item in parallel with others
  const [
    breadcrumbsResult,
    childItemsResult,
    filesResult,
    progressResult,
    driveConnection,
    nextItemResult, // NEW
  ] = await Promise.all([
    getAncestors(itemId),
    getDescendants(itemId),
    getItemFiles(itemId),
    getItemProgress(itemId),
    getGoogleDriveConnection(),
    getFirstIncompleteItem(itemId), // NEW - get first incomplete among descendants
  ]);

  // ... existing processing ...

  const nextItem = nextItemResult.success ? nextItemResult.data : null;

  return (
    <ItemDetailClient
      item={item}
      childItems={childItems}
      files={files}
      artworkId={artworkId}
      itemProgress={itemProgress}
      hasDriveConnection={hasDriveConnection}
      nextItem={nextItem} // NEW
    />
  );
}
```

**Step 4: Update ItemDetailClient**

Modify `components/items/item-detail-client.tsx`:

```typescript
import type { NextItem } from "@/lib/types";
import { useGoToItem } from "@/hooks/use-goto-item";

interface ItemDetailClientProps {
  // ... existing props ...
  /** First incomplete descendant for "Go to" navigation. */
  nextItem?: NextItem | null;
}

export function ItemDetailClient({
  // ... existing props ...
  nextItem,
}: ItemDetailClientProps) {
  // ... existing state ...

  // Use shared navigation hook
  const handleGoToNext = useGoToItem();

  return (
    <div /* ... */>
      <ItemHero
        // ... existing props ...
        nextItem={nextItem}
        onGoToNext={handleGoToNext}
      />
      {/* ... rest of component ... */}
    </div>
  );
}
```

**Step 5: Write component unit test**

Add to `tests/unit/components/items/item-detail-client.test.tsx`:

```typescript
import type { NextItem } from "@/lib/types";

describe("go to next item", () => {
  const mockNextItem: NextItem = {
    id: "next-123",
    name: "Episode 2",
  };

  it("passes nextItem to ItemHero", () => {
    render(
      <ItemDetailClient
        item={{ id: "1", name: "TV Show", description: null }}
        childItems={[]}
        nextItem={mockNextItem}
      />
    );

    expect(screen.getByTestId("item-hero-goto")).toHaveTextContent(
      "Go to Episode 2"
    );
  });

  it("navigates to next item on click", async () => {
    render(
      <ItemDetailClient
        item={{ id: "1", name: "TV Show", description: null }}
        childItems={[]}
        nextItem={mockNextItem}
      />
    );

    await userEvent.click(screen.getByTestId("item-hero-goto"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-items/next-123");
  });
});
```

**Step 6: Run tests**

```bash
pnpm run test:unit tests/unit/hooks/use-goto-item.test.ts tests/unit/components/items/item-detail-client.test.tsx
```

Expected: PASS

**Step 7: Commit**

```bash
git add hooks/use-goto-item.ts app/(my-items)/my-items/[itemId]/page.tsx components/items/item-detail-client.tsx tests/unit/hooks/use-goto-item.test.ts tests/unit/components/items/item-detail-client.test.tsx
git commit -m "$(cat <<'EOF'
feat: wire up go-to button on item detail pages

- Add shared useGoToItem hook for navigation
- Update ItemDetailClient to use hook
- Fetch nextItem in page server component
EOF
)"
```

---

## Task 6: Wire Up My Items Page with Go To Button

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx`
- Modify: `components/items/items-view.tsx`
- Test: `tests/unit/components/items-view.test.tsx`

**Step 1: Update MyItemsPage to fetch nextItem**

Modify `app/(my-items)/my-items/page.tsx`:

```typescript
import { getFirstIncompleteItem } from "@/lib/item-actions";

export default async function MyItemsPage() {
  const [itemsResult, profileResult, driveConnection, libraryProgress, nextItemResult] =
    await Promise.all([
      getAllItems(),
      getProfile(),
      getGoogleDriveConnection(),
      getLibraryProgress(),
      getFirstIncompleteItem(), // NEW - library-wide
    ]);

  const nextItem = nextItemResult.success ? nextItemResult.data : null;

  return (
    <>
      {/* ... */}
      <ItemsView
        items={items}
        heroTitle="My Items"
        heroBackgroundUrl={hasHeroImage ? "/api/user/hero" : undefined}
        heroProgress={libraryProgress}
        heroNextItem={nextItem} // NEW
        hasDriveConnection={hasDriveConnection}
      />
    </>
  );
}
```

**Step 2: Update ItemsView to handle next item**

Modify `components/items/items-view.tsx`:

```typescript
import type { NextItem } from "@/lib/types";
import { useGoToItem } from "@/hooks/use-goto-item";

interface ItemsViewProps {
  // ... existing props ...
  /** Next incomplete item for hero display (library-wide). */
  heroNextItem?: NextItem | null;
}

export function ItemsView({
  // ... existing props ...
  heroNextItem,
}: ItemsViewProps) {
  // ... existing code ...

  // Use shared navigation hook (same as ItemDetailClient)
  const handleHeroGoToNext = useGoToItem();

  return (
    <div /* ... */>
      {heroTitle && (
        <ItemHero
          name={heroTitle}
          backgroundUrl={heroBackgroundUrl}
          progressPercentage={heroProgress?.percentage ?? null}
          progressLabel={heroProgress ? formatProgressLabel(heroProgress) : null}
          isCollapsed={isCollapsed}
          onCollapse={toggleCollapse}
          nextItem={heroNextItem}
          onGoToNext={handleHeroGoToNext}
        />
      )}
      {/* ... rest ... */}
    </div>
  );
}
```

**Step 3: Write unit test**

Add to `tests/unit/components/items-view.test.tsx`:

```typescript
import type { NextItem } from "@/lib/types";

describe("hero go-to button", () => {
  const mockNextItem: NextItem = {
    id: "next-123",
    name: "Breaking Bad S01E02",
  };

  it("shows go-to button in hero when heroNextItem provided", () => {
    render(
      <ItemsView
        items={[]}
        heroTitle="My Items"
        heroNextItem={mockNextItem}
      />
    );

    expect(screen.getByTestId("item-hero-goto")).toHaveTextContent(
      "Go to Breaking Bad S01E02"
    );
  });

  it("navigates to next item on hero go-to click", async () => {
    render(
      <ItemsView
        items={[]}
        heroTitle="My Items"
        heroNextItem={mockNextItem}
      />
    );

    await userEvent.click(screen.getByTestId("item-hero-goto"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-items/next-123");
  });
});
```

**Step 4: Run tests**

```bash
pnpm run test:unit tests/unit/components/items-view.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/(my-items)/my-items/page.tsx components/items/items-view.tsx tests/unit/components/items-view.test.tsx
git commit -m "$(cat <<'EOF'
feat: add go-to button to My Items hero
EOF
)"
```

---

## Task 7: Add E2E Tests

**Files:**

- Modify: `e2e/journeys/items/item-progress.spec.ts`

**Step 1: Write E2E tests**

Add to `e2e/journeys/items/item-progress.spec.ts`:

```typescript
import { test, expect } from "../../fixtures";

test.describe("Go to Next Item", () => {
  // Use database fixture for deterministic test data
  test.beforeEach(async ({ testDb, testUser }) => {
    // Clean up any existing test items
    await testDb.cleanupUserItems(testUser.id);
  });

  test.afterEach(async ({ testDb, testUser }) => {
    await testDb.cleanupUserItems(testUser.id);
  });

  test("shows Go to button when incomplete item exists", async ({
    page,
    testDb,
    testUser,
  }) => {
    // Setup: Create item with incomplete primary media
    await testDb.createItem({
      name: "Incomplete Movie",
      userId: testUser.id,
      order: 0,
      depth: 0,
    });
    const item = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: item.id,
      filename: "movie.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 50,
      playbackDuration: 100,
    });

    await page.goto("/my-items");
    const gotoButton = page.getByTestId("item-hero-goto");

    await expect(gotoButton).toBeVisible();
    await expect(gotoButton).toContainText("Go to Incomplete Movie");
  });

  test("hides Go to button when all items are complete", async ({
    page,
    testDb,
    testUser,
  }) => {
    // Setup: Create item with complete primary media (95%)
    await testDb.createItem({
      name: "Complete Movie",
      userId: testUser.id,
      order: 0,
      depth: 0,
    });
    const item = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: item.id,
      filename: "movie.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 95,
      playbackDuration: 100,
    });

    await page.goto("/my-items");
    const gotoButton = page.getByTestId("item-hero-goto");

    await expect(gotoButton).not.toBeVisible();
  });

  test("navigates to item when Go to button clicked", async ({
    page,
    testDb,
    testUser,
  }) => {
    // Setup: Create incomplete item
    await testDb.createItem({
      name: "Target Item",
      userId: testUser.id,
      order: 0,
      depth: 0,
    });
    const item = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: item.id,
      filename: "video.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 30,
      playbackDuration: 100,
    });

    await page.goto("/my-items");
    const gotoButton = page.getByTestId("item-hero-goto");

    await gotoButton.click();
    await expect(page).toHaveURL(`/my-items/${item.id}`);
  });

  test("shows both Play and Go to when item has media and incomplete children", async ({
    page,
    testDb,
    testUser,
  }) => {
    // Setup: Create parent with complete media
    await testDb.createItem({
      name: "TV Show",
      userId: testUser.id,
      order: 0,
      depth: 0,
    });
    const parent = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: parent.id,
      filename: "intro.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 95,
      playbackDuration: 100,
    });

    // Create incomplete child
    await testDb.createItem({
      name: "Episode 1",
      userId: testUser.id,
      parentId: parent.id,
      order: 0,
      depth: 1,
    });
    const child = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: child.id,
      filename: "ep1.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 0,
      playbackDuration: 3600,
    });

    await page.goto(`/my-items/${parent.id}`);

    const playButton = page.getByTestId("item-hero-play");
    const gotoButton = page.getByTestId("item-hero-goto");

    await expect(playButton).toBeVisible();
    await expect(gotoButton).toBeVisible();
    await expect(gotoButton).toContainText("Go to Episode 1");
  });

  test("follows DFS order - finds nested incomplete before root sibling", async ({
    page,
    testDb,
    testUser,
  }) => {
    // Setup: Create folder with incomplete child
    await testDb.createItem({
      name: "Folder",
      userId: testUser.id,
      order: 0,
      depth: 0,
    });
    const folder = await testDb.getLastCreatedItem();

    await testDb.createItem({
      name: "Nested Movie",
      userId: testUser.id,
      parentId: folder.id,
      order: 0,
      depth: 1,
    });
    const nested = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: nested.id,
      filename: "nested.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 50,
      playbackDuration: 100,
    });

    // Create root-level incomplete (should NOT be shown - DFS visits folder first)
    await testDb.createItem({
      name: "Root Movie",
      userId: testUser.id,
      order: 1,
      depth: 0,
    });
    const root = await testDb.getLastCreatedItem();
    await testDb.createItemFile({
      itemId: root.id,
      filename: "root.mp4",
      fileType: "MEDIA",
      isPrimary: true,
      playbackPosition: 30,
      playbackDuration: 100,
    });

    await page.goto("/my-items");
    const gotoButton = page.getByTestId("item-hero-goto");

    // Should show "Nested Movie" not "Root Movie" due to DFS order
    await expect(gotoButton).toContainText("Go to Nested Movie");
  });
});
```

**Step 2: Run E2E tests**

```bash
pnpm run test:e2e e2e/journeys/items/item-progress.spec.ts
```

Expected: PASS

**Step 3: Commit**

```bash
git add e2e/journeys/items/item-progress.spec.ts
git commit -m "$(cat <<'EOF'
test: add E2E tests for go-to next item feature
EOF
)"
```

---

## Task 8: Run Full Test Suite and Final Verification

**Step 1: Run all unit tests**

```bash
pnpm run test:unit
```

Expected: All tests pass

**Step 2: Run all integration tests**

```bash
pnpm run test:integration
```

Expected: All tests pass

**Step 3: Run full check suite**

```bash
pnpm run check
```

Expected: Format, lint, type-check, knip, and build all pass

**Step 4: Manual verification**

1. Start dev server: `pnpm run dev`
2. Sign in and verify:
   - My Items page shows "Go to [ItemName]" for first incomplete item
   - Clicking navigates to that item
   - Item detail page with no media shows "Go to [ChildName]"
   - Item detail page with media shows both "Resume" and "Go to" buttons (same style)
   - All items complete = no "Go to" button

**Step 5: Final commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat: complete go-to next item feature with DFS traversal

- Add NextItem type for navigation data
- Add findFirstIncompleteItem utility for DFS traversal
- Add getFirstIncompleteItem server action
- Update ItemHero with Go to button (same style as Resume)
- Wire up item detail and My Items pages
- Add comprehensive unit, integration, and E2E tests
EOF
)"
```

---

## Summary

| Task | Description                              | Files                                                           |
| ---- | ---------------------------------------- | --------------------------------------------------------------- |
| 1    | Add NextItem type                        | `lib/types.ts`                                                  |
| 2    | Add findFirstIncompleteItem utility      | `lib/progress-utils.ts`, tests (incl. 90% boundary)             |
| 3    | Add getFirstIncompleteItem server action | `lib/item-actions.ts`, integration tests                        |
| 4    | Update ItemHero with Go to button        | `components/items/item-hero.tsx`, tests (incl. tooltip)         |
| 5    | Wire up ItemDetailClient                 | `hooks/use-goto-item.ts`, `item-detail-client.tsx`, page, tests |
| 6    | Wire up My Items page                    | `my-items/page.tsx`, `items-view.tsx` (uses shared hook), tests |
| 7    | Add E2E tests                            | `e2e/journeys/items/item-progress.spec.ts` (deterministic)      |
| 8    | Final verification                       | All tests pass                                                  |

## Button Behavior Summary

| Scenario                                   | Buttons Shown                   |
| ------------------------------------------ | ------------------------------- |
| Item has media, no incomplete children     | Resume/Play only                |
| Item has media, has incomplete children    | Resume/Play + Go to [ChildName] |
| Item has no media, has incomplete children | Go to [ChildName] only          |
| Item has no media, no incomplete children  | No buttons                      |
| My Items with incomplete item in library   | Go to [ItemName]                |
| My Items with all items complete           | No Go to button                 |

Both buttons use the same `variant="glass"` style for visual consistency.
