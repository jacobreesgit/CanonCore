# Continue Watching (DFS-Based) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add intelligent "Continue Watching" buttons that find the first incomplete item in DFS order across item hierarchies.

**Architecture:** Server action `getFirstIncompleteItem()` traverses descendants via recursive CTE and returns the first item with incomplete primary media (< 90%). The hero component displays either a single "Continue" button (when current item has no media) or dual buttons (current Resume + child Continue).

**Tech Stack:** TypeScript, Prisma raw SQL (recursive CTE), React Server Components, Next.js Server Actions

---

## Feature Requirements

1. **Item with NO media but HAS children with media:** Show "Continue [ItemName]" button for first incomplete descendant in DFS order
2. **Item with media:** Show existing "Resume" button (left) + "Continue [ChildName]" button (right) for first incomplete descendant
3. **My Items root page:** Show "Continue [ItemName]" button for first incomplete item in entire library

## Key Definitions

- **Incomplete item:** Has primary media file with `playbackPosition < playbackDuration * 0.9`
- **DFS order:** Depth-first search visiting children by `order` field, descending into each child before siblings
- **Primary media:** The file marked `isPrimary=true` with `fileType=MEDIA`, or first media file if none marked

---

## Task 1: Add ContinueItem Type

**Files:**

- Modify: `lib/types.ts:403`

**Step 1: Write the type definition**

Add after line 403 (after `isValidViewMode` function):

```typescript
/**
 * Minimal item data for "Continue Watching" button display.
 * Returned by getFirstIncompleteItem() server action.
 */
export interface ContinueItem {
  /** Item ID for navigation */
  id: string;
  /** Item name for button label */
  name: string;
  /** Artwork ID for optional thumbnail */
  artworkId: string | null;
  /** Primary media filename */
  primaryMediaName: string | null;
  /** Current playback position (seconds) for progress display */
  playbackPosition: number | null;
  /** Total duration (seconds) */
  playbackDuration: number | null;
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
feat: add ContinueItem type for continue watching feature
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
    expect(result.data?.primaryMediaName).toBe("movie.mp4");
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

  it("returns null when no items have media", async () => {
    await prisma.item.create({
      data: {
        name: "Folder",
        userId: testUser.id,
        order: 0,
        depth: 0,
      },
    });

    const result = await getFirstIncompleteItem();
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("returns item with null position (not started)", async () => {
    const item = await prisma.item.create({
      data: {
        name: "Not Started",
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
        playbackPosition: null,
        playbackDuration: 100,
      },
    });

    const result = await getFirstIncompleteItem();
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(item.id);
    expect(result.data?.playbackPosition).toBeNull();
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
import type { ContinueItem } from "./types";
import {
  findFirstIncompleteItem,
  COMPLETION_THRESHOLD,
} from "./progress-utils";

/**
 * Gets the first incomplete item in DFS order.
 * Used for "Continue Watching" button on My Items and item detail pages.
 *
 * @param parentId - Optional parent ID to search within (null = entire library)
 * @returns First incomplete item data or null if all complete
 */
export async function getFirstIncompleteItem(
  parentId?: string | null
): Promise<ItemResult<ContinueItem | null>> {
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
            artworkId: string | null;
            hasPrimaryMedia: boolean;
            primaryMediaName: string | null;
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
            (SELECT f."driveFileId" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'ARTWORK' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "artworkId",
            EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA') as "hasPrimaryMedia",
            (SELECT f.filename FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "primaryMediaName",
            (SELECT f."playbackPosition" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "position",
            (SELECT f."playbackDuration" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "duration"
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
            artworkId: string | null;
            hasPrimaryMedia: boolean;
            primaryMediaName: string | null;
            position: number | null;
            duration: number | null;
          }[]
        >`
          SELECT
            i.id,
            i.name,
            i."order",
            i."parentId",
            (SELECT f."driveFileId" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'ARTWORK' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "artworkId",
            EXISTS(SELECT 1 FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA') as "hasPrimaryMedia",
            (SELECT f.filename FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "primaryMediaName",
            (SELECT f."playbackPosition" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "position",
            (SELECT f."playbackDuration" FROM "ItemFile" f WHERE f."itemId" = i.id AND f."fileType" = 'MEDIA' ORDER BY f."isPrimary" DESC, f."createdAt" ASC LIMIT 1) as "duration"
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
        artworkId: incompleteItem.artworkId,
        primaryMediaName: incompleteItem.primaryMediaName,
        playbackPosition: incompleteItem.position,
        playbackDuration: incompleteItem.duration,
      },
    };
  } catch (error) {
    logger.error({ error }, "Failed to get first incomplete item");
    return { error: "Failed to get continue watching item" };
  }
}
```

**Step 4: Run integration test**

```bash
pnpm run test:integration tests/integration/items/item-progress.test.ts
```

Expected: PASS

**Step 5: Run type check**

```bash
pnpm run type-check
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/item-actions.ts tests/integration/items/item-progress.test.ts
git commit -m "$(cat <<'EOF'
feat: add getFirstIncompleteItem server action for continue watching
EOF
)"
```

---

## Task 4: Update ItemHero to Support Continue Button

**Files:**

- Modify: `components/items/item-hero.tsx`
- Test: `tests/unit/components/items/item-hero.test.tsx`

**Step 1: Write the failing test**

Add to `tests/unit/components/items/item-hero.test.tsx`:

```typescript
import { ContinueItem } from "@/lib/types";

describe("ItemHero continue button", () => {
  const mockContinueItem: ContinueItem = {
    id: "continue-123",
    name: "Breaking Bad S01E02",
    artworkId: "art-456",
    primaryMediaName: "episode.mp4",
    playbackPosition: 1200,
    playbackDuration: 3600,
  };

  it("shows Continue button when no media but continueItem provided", () => {
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        continueItem={mockContinueItem}
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByTestId("item-hero-continue")).toBeInTheDocument();
    expect(screen.getByTestId("item-hero-continue")).toHaveTextContent(
      "Continue Breaking Bad S01E02"
    );
    expect(screen.queryByTestId("item-hero-play")).not.toBeInTheDocument();
  });

  it("shows both Resume and Continue buttons when has media and continueItem", () => {
    render(
      <ItemHero
        name="Movie"
        hasMedia={true}
        hasProgress={true}
        primaryMediaName="movie.mp4"
        onPlay={vi.fn()}
        continueItem={mockContinueItem}
        onContinue={vi.fn()}
      />
    );

    expect(screen.getByTestId("item-hero-play")).toBeInTheDocument();
    expect(screen.getByTestId("item-hero-continue")).toBeInTheDocument();
  });

  it("calls onContinue when Continue button clicked", async () => {
    const onContinue = vi.fn();
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        continueItem={mockContinueItem}
        onContinue={onContinue}
      />
    );

    await userEvent.click(screen.getByTestId("item-hero-continue"));
    expect(onContinue).toHaveBeenCalledWith(mockContinueItem);
  });

  it("does not show Continue button without onContinue callback", () => {
    render(
      <ItemHero
        name="TV Shows"
        hasMedia={false}
        continueItem={mockContinueItem}
      />
    );

    expect(screen.queryByTestId("item-hero-continue")).not.toBeInTheDocument();
  });

  it("does not show Continue button when continueItem is null", () => {
    render(
      <ItemHero
        name="Movie"
        hasMedia={true}
        onPlay={vi.fn()}
        continueItem={null}
        onContinue={vi.fn()}
      />
    );

    expect(screen.queryByTestId("item-hero-continue")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm run test:unit tests/unit/components/items/item-hero.test.tsx
```

Expected: FAIL - `continueItem` and `onContinue` props not defined

**Step 3: Update ItemHero component**

Modify `components/items/item-hero.tsx`:

```typescript
import type { ContinueItem } from "@/lib/types";

interface ItemHeroProps {
  // ... existing props ...
  /** Item to continue watching (first incomplete descendant). */
  continueItem?: ContinueItem | null;
  /** Callback when continue button clicked. */
  onContinue?: (item: ContinueItem) => void;
}

export function ItemHero({
  // ... existing props ...
  continueItem,
  onContinue,
}: ItemHeroProps) {
  // ... existing logic ...

  // Show continue button when:
  // 1. continueItem exists AND onContinue callback exists
  // 2. Either: no media on current item OR has media (show both)
  const showContinue = continueItem && onContinue;

  return (
    <motion.section /* ... */>
      {isCollapsedState ? (
        // Collapsed content - update buttons section
        <motion.div /* ... */>
          {/* ... name ... */}
          <div className="flex items-center gap-2">
            {hasMedia && onPlay && (
              <Button /* existing play button */ />
            )}
            {showContinue && (
              <Button
                size="sm"
                variant="glass"
                onClick={() => onContinue(continueItem)}
                className="max-w-[200px] gap-2"
                data-testid="item-hero-continue"
              >
                <Play className="size-4 shrink-0" />
                <span className="truncate">
                  Continue {continueItem.name}
                </span>
              </Button>
            )}
            {/* collapse button */}
          </div>
        </motion.div>
      ) : (
        // Expanded content - update buttons section
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

            {/* Continue button for first incomplete descendant */}
            {showContinue && (
              <Button
                size="lg"
                variant={hasMedia ? "outline" : "glass"}
                onClick={() => onContinue(continueItem)}
                className="max-w-xs gap-2 border-white/30 text-white hover:bg-white/10"
                data-testid="item-hero-continue"
              >
                <Play className="size-5 shrink-0" />
                <span className="truncate">
                  Continue {continueItem.name}
                </span>
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
feat: add continue button support to ItemHero component
EOF
)"
```

---

## Task 5: Wire Up ItemDetailClient with Continue Watching

**Files:**

- Modify: `components/items/item-detail-client.tsx`
- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`
- Test: `tests/unit/components/items/item-detail-client.test.tsx`

**Step 1: Update the page to fetch continueItem**

Modify `app/(my-items)/my-items/[itemId]/page.tsx` to fetch and pass continueItem:

```typescript
import { getFirstIncompleteItem } from "@/lib/item-actions";

export default async function ItemDetailPage({ params }: Props) {
  // ... existing fetches ...

  // Fetch continue item in parallel with others
  const [
    breadcrumbsResult,
    childItemsResult,
    filesResult,
    progressResult,
    driveConnection,
    continueItemResult, // NEW
  ] = await Promise.all([
    getAncestors(itemId),
    getDescendants(itemId),
    getItemFiles(itemId),
    getItemProgress(itemId),
    getGoogleDriveConnection(),
    getFirstIncompleteItem(itemId), // NEW - get first incomplete among descendants
  ]);

  // ... existing processing ...

  const continueItem = continueItemResult.success ? continueItemResult.data : null;

  return (
    <ItemDetailClient
      item={item}
      childItems={childItems}
      files={files}
      artworkId={artworkId}
      itemProgress={itemProgress}
      hasDriveConnection={hasDriveConnection}
      continueItem={continueItem} // NEW
    />
  );
}
```

**Step 2: Update ItemDetailClient**

Modify `components/items/item-detail-client.tsx`:

```typescript
import type { ContinueItem } from "@/lib/types";

interface ItemDetailClientProps {
  // ... existing props ...
  /** First incomplete descendant for continue watching. */
  continueItem?: ContinueItem | null;
}

export function ItemDetailClient({
  // ... existing props ...
  continueItem,
}: ItemDetailClientProps) {
  const router = useRouter();
  // ... existing state ...

  /**
   * Handles continue button click - navigates to item and starts playback.
   */
  const handleContinue = useCallback(
    (item: ContinueItem) => {
      router.push(`/my-items/${item.id}`);
    },
    [router]
  );

  return (
    <div /* ... */>
      <ItemHero
        // ... existing props ...
        continueItem={continueItem}
        onContinue={handleContinue}
      />
      {/* ... rest of component ... */}
    </div>
  );
}
```

**Step 3: Write unit test**

Add to `tests/unit/components/items/item-detail-client.test.tsx`:

```typescript
describe("continue watching", () => {
  const mockContinueItem: ContinueItem = {
    id: "continue-123",
    name: "Episode 2",
    artworkId: null,
    primaryMediaName: "ep2.mp4",
    playbackPosition: 1200,
    playbackDuration: 3600,
  };

  it("passes continueItem to ItemHero", () => {
    render(
      <ItemDetailClient
        item={{ id: "1", name: "TV Show", description: null }}
        childItems={[]}
        continueItem={mockContinueItem}
      />
    );

    expect(screen.getByTestId("item-hero-continue")).toHaveTextContent(
      "Continue Episode 2"
    );
  });

  it("navigates to continue item on click", async () => {
    render(
      <ItemDetailClient
        item={{ id: "1", name: "TV Show", description: null }}
        childItems={[]}
        continueItem={mockContinueItem}
      />
    );

    await userEvent.click(screen.getByTestId("item-hero-continue"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-items/continue-123");
  });
});
```

**Step 4: Run tests**

```bash
pnpm run test:unit tests/unit/components/items/item-detail-client.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/(my-items)/my-items/[itemId]/page.tsx components/items/item-detail-client.tsx tests/unit/components/items/item-detail-client.test.tsx
git commit -m "$(cat <<'EOF'
feat: wire up continue watching on item detail pages
EOF
)"
```

---

## Task 6: Wire Up My Items Page with Continue Watching

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx`
- Modify: `components/items/items-view.tsx`
- Test: `tests/unit/components/items-view.test.tsx`

**Step 1: Update MyItemsPage to fetch continueItem**

Modify `app/(my-items)/my-items/page.tsx`:

```typescript
import { getFirstIncompleteItem } from "@/lib/item-actions";

export default async function MyItemsPage() {
  const [itemsResult, profileResult, driveConnection, libraryProgress, continueItemResult] =
    await Promise.all([
      getAllItems(),
      getProfile(),
      getGoogleDriveConnection(),
      getLibraryProgress(),
      getFirstIncompleteItem(), // NEW - library-wide
    ]);

  const continueItem = continueItemResult.success ? continueItemResult.data : null;

  return (
    <>
      {/* ... */}
      <ItemsView
        items={items}
        heroTitle="My Items"
        heroBackgroundUrl={hasHeroImage ? "/api/user/hero" : undefined}
        heroProgress={libraryProgress}
        heroContinueItem={continueItem} // NEW
        hasDriveConnection={hasDriveConnection}
      />
    </>
  );
}
```

**Step 2: Update ItemsView to handle continue item**

Modify `components/items/items-view.tsx`:

```typescript
import type { ContinueItem } from "@/lib/types";

interface ItemsViewProps {
  // ... existing props ...
  /** Continue item for hero display (library-wide). */
  heroContinueItem?: ContinueItem | null;
}

export function ItemsView({
  // ... existing props ...
  heroContinueItem,
}: ItemsViewProps) {
  const router = useRouter();
  // ... existing code ...

  /**
   * Handles continue button click from hero.
   */
  const handleHeroContinue = useCallback(
    (item: ContinueItem) => {
      router.push(`/my-items/${item.id}`);
    },
    [router]
  );

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
          continueItem={heroContinueItem}
          onContinue={handleHeroContinue}
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
describe("hero continue watching", () => {
  const mockContinueItem: ContinueItem = {
    id: "continue-123",
    name: "Breaking Bad S01E02",
    artworkId: null,
    primaryMediaName: "ep.mp4",
    playbackPosition: 1200,
    playbackDuration: 3600,
  };

  it("shows continue button in hero when heroContinueItem provided", () => {
    render(
      <ItemsView
        items={[]}
        heroTitle="My Items"
        heroContinueItem={mockContinueItem}
      />
    );

    expect(screen.getByTestId("item-hero-continue")).toHaveTextContent(
      "Continue Breaking Bad S01E02"
    );
  });

  it("navigates to continue item on hero continue click", async () => {
    render(
      <ItemsView
        items={[]}
        heroTitle="My Items"
        heroContinueItem={mockContinueItem}
      />
    );

    await userEvent.click(screen.getByTestId("item-hero-continue"));
    expect(mockRouter.push).toHaveBeenCalledWith("/my-items/continue-123");
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
feat: add continue watching button to My Items hero
EOF
)"
```

---

## Task 7: Add E2E Tests for Continue Watching

**Files:**

- Modify: `e2e/journeys/items/item-progress.spec.ts`

**Step 1: Write E2E tests**

Add to `e2e/journeys/items/item-progress.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Continue Watching", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as test user
    await page.goto("/sign-in");
    await page.fill('[data-testid="email-input"]', "test@example.com");
    await page.fill('[data-testid="password-input"]', "Password123");
    await page.click('[data-testid="sign-in-button"]');
    await page.waitForURL("/my-items");
  });

  test("shows Continue button on My Items page when incomplete item exists", async ({
    page,
    db,
  }) => {
    // Create item with incomplete media
    const item = await db.item.create({
      data: {
        name: "Test Movie",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });
    await db.itemFile.create({
      data: {
        itemId: item.id,
        filename: "movie.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 1200, // 20 min watched
        playbackDuration: 7200, // 2 hour movie
      },
    });

    await page.reload();
    const continueButton = page.getByTestId("item-hero-continue");
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toContainText("Continue Test Movie");
  });

  test("navigates to item when Continue button clicked", async ({
    page,
    db,
  }) => {
    const item = await db.item.create({
      data: {
        name: "Incomplete Movie",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });
    await db.itemFile.create({
      data: {
        itemId: item.id,
        filename: "movie.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 50,
        playbackDuration: 100,
      },
    });

    await page.reload();
    await page.click('[data-testid="item-hero-continue"]');
    await expect(page).toHaveURL(`/my-items/${item.id}`);
  });

  test("shows Continue button on item detail page for incomplete child", async ({
    page,
    db,
  }) => {
    // Create folder with incomplete child
    const folder = await db.item.create({
      data: {
        name: "TV Show",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });
    const episode = await db.item.create({
      data: {
        name: "S01E02",
        parentId: folder.id,
        userId: testUserId,
        order: 0,
        depth: 1,
      },
    });
    await db.itemFile.create({
      data: {
        itemId: episode.id,
        filename: "ep.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 50,
        playbackDuration: 100,
      },
    });

    await page.goto(`/my-items/${folder.id}`);
    const continueButton = page.getByTestId("item-hero-continue");
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toContainText("Continue S01E02");
  });

  test("shows both Resume and Continue when item has media and incomplete children", async ({
    page,
    db,
  }) => {
    // Create item with its own media + incomplete child
    const item = await db.item.create({
      data: {
        name: "Movie Collection",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });
    await db.itemFile.create({
      data: {
        itemId: item.id,
        filename: "intro.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 10,
        playbackDuration: 60,
      },
    });

    const child = await db.item.create({
      data: {
        name: "Sequel",
        parentId: item.id,
        userId: testUserId,
        order: 0,
        depth: 1,
      },
    });
    await db.itemFile.create({
      data: {
        itemId: child.id,
        filename: "sequel.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 0,
        playbackDuration: 100,
      },
    });

    await page.goto(`/my-items/${item.id}`);

    // Both buttons should be visible
    await expect(page.getByTestId("item-hero-play")).toBeVisible();
    await expect(page.getByTestId("item-hero-continue")).toBeVisible();
    await expect(page.getByTestId("item-hero-continue")).toContainText(
      "Continue Sequel"
    );
  });

  test("does not show Continue button when all items are complete", async ({
    page,
    db,
  }) => {
    const item = await db.item.create({
      data: {
        name: "Complete Movie",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });
    await db.itemFile.create({
      data: {
        itemId: item.id,
        filename: "movie.mp4",
        fileType: "MEDIA",
        isPrimary: true,
        playbackPosition: 95, // >= 90% complete
        playbackDuration: 100,
      },
    });

    await page.reload();
    await expect(page.getByTestId("item-hero-continue")).not.toBeVisible();
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
test: add E2E tests for continue watching feature
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

**Step 3: Run E2E tests**

```bash
pnpm run test:e2e
```

Expected: All tests pass

**Step 4: Run full check suite**

```bash
pnpm run check
```

Expected: Format, lint, type-check, knip, and build all pass

**Step 5: Manual verification**

1. Start dev server: `pnpm run dev`
2. Sign in and create test data:
   - Create "Movies" folder
   - Add child "Star Wars" with media file
   - Play Star Wars partially (< 90%)
3. Verify My Items page shows "Continue Star Wars" button
4. Verify clicking button navigates to Star Wars item
5. Verify Movies folder page shows "Continue Star Wars" button
6. Complete Star Wars (> 90%)
7. Verify Continue buttons no longer appear

**Step 6: Final commit**

```bash
git add .
git commit -m "$(cat <<'EOF'
feat: complete continue watching feature with DFS traversal

- Add ContinueItem type for continue watching data
- Add findFirstIncompleteItem utility for DFS traversal
- Add getFirstIncompleteItem server action
- Update ItemHero to support Continue button
- Wire up item detail and My Items pages
- Add comprehensive unit, integration, and E2E tests
EOF
)"
```

---

## Summary

| Task | Description                              | Files                                        |
| ---- | ---------------------------------------- | -------------------------------------------- |
| 1    | Add ContinueItem type                    | `lib/types.ts`                               |
| 2    | Add findFirstIncompleteItem utility      | `lib/progress-utils.ts`, tests               |
| 3    | Add getFirstIncompleteItem server action | `lib/item-actions.ts`, integration tests     |
| 4    | Update ItemHero for Continue button      | `components/items/item-hero.tsx`, tests      |
| 5    | Wire up ItemDetailClient                 | `item-detail-client.tsx`, page, tests        |
| 6    | Wire up My Items page                    | `my-items/page.tsx`, `items-view.tsx`, tests |
| 7    | Add E2E tests                            | `e2e/journeys/items/item-progress.spec.ts`   |
| 8    | Final verification                       | All tests pass                               |

## Test Coverage

- **Unit tests:** findFirstIncompleteItem DFS logic, ItemHero Continue button rendering
- **Integration tests:** getFirstIncompleteItem server action with real database
- **E2E tests:** Full user flow for continue watching on My Items and item detail pages
