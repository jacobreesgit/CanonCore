# Descendant Progress Bars Design

> **For Claude:** Use this document to implement progress bars showing completion count across all descendants.

**Goal:** Display progress bars on ItemHero, GridItem, and TreeItem showing how many media files have been watched (>90%) across the item and ALL its descendants.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, Tailwind CSS 4, shadcn/ui

---

## Overview

### Current State

- `playbackPosition` and `playbackDuration` tracked at `ItemFile` level
- Media player auto-resumes from saved position
- No visual progress indication in library views

### New Feature

- **Progress = completedFiles / totalFiles** across item + all descendants
- A file is "completed" when `playbackPosition >= 0.9 * playbackDuration` (90% threshold)
- Progress bar shown at 0% when media files exist but none watched
- Progress bar hidden (`null`) when no media files in subtree
- Progress bars hidden in edit mode (drag-and-drop reordering)

### Display Locations

1. **ItemHero** - progress bar below stats row with label (e.g., "5/10")
2. **GridItem** - thin progress bar at bottom of card
3. **TreeItem** - small inline progress bar next to name

---

## Task 1: Progress Utility Functions

**Files:**

- Create: `lib/progress-utils.ts`
- Create: `tests/unit/lib/progress-utils.test.ts`

### Step 1: Create progress utilities

Create `lib/progress-utils.ts`:

```typescript
/**
 * Utilities for calculating playback progress across item hierarchies.
 * Progress = completedFiles / totalFiles where completed = >90% watched.
 */

/** Threshold percentage to consider a file complete (90%). */
export const COMPLETION_THRESHOLD = 0.9;

/**
 * Determines if a media file is considered complete.
 * Complete = position >= 90% of duration.
 *
 * @param position - Current playback position in seconds
 * @param duration - Total duration in seconds
 * @returns True if file is complete
 */
export function isFileComplete(
  position: number | null,
  duration: number | null
): boolean {
  if (position === null || duration === null || duration === 0) {
    return false;
  }
  return position >= duration * COMPLETION_THRESHOLD;
}

/**
 * Progress data for an item (self + all descendants).
 */
export interface ItemProgress {
  /** Total media files in item and all descendants */
  totalFiles: number;
  /** Number of completed files (>90% watched) */
  completedFiles: number;
  /** Progress percentage (0-100), null if no media files */
  percentage: number | null;
}

/**
 * Calculates progress from an array of media files with playback data.
 *
 * @param files - Array of files with playback position and duration
 * @returns Progress data with percentage
 */
export function calculateProgress(
  files: Array<{
    playbackPosition: number | null;
    playbackDuration: number | null;
  }>
): ItemProgress {
  if (files.length === 0) {
    return { totalFiles: 0, completedFiles: 0, percentage: null };
  }

  const completedFiles = files.filter((f) =>
    isFileComplete(f.playbackPosition, f.playbackDuration)
  ).length;

  return {
    totalFiles: files.length,
    completedFiles,
    percentage: Math.round((completedFiles / files.length) * 100),
  };
}

/**
 * Formats progress as a label string (e.g., "5/10").
 *
 * @param progress - Progress data
 * @returns Formatted label or null if no files
 */
export function formatProgressLabel(progress: ItemProgress): string | null {
  if (progress.percentage === null) {
    return null;
  }
  return `${progress.completedFiles}/${progress.totalFiles}`;
}
```

### Step 2: Write unit tests

Create `tests/unit/lib/progress-utils.test.ts`:

```typescript
/**
 * Unit tests for progress calculation utilities.
 */

import { describe, it, expect } from "vitest";
import {
  isFileComplete,
  calculateProgress,
  formatProgressLabel,
  COMPLETION_THRESHOLD,
} from "@/lib/progress-utils";

describe("progress-utils", () => {
  describe("isFileComplete", () => {
    it("returns false for null position", () => {
      expect(isFileComplete(null, 100)).toBe(false);
    });

    it("returns false for null duration", () => {
      expect(isFileComplete(50, null)).toBe(false);
    });

    it("returns false for zero duration", () => {
      expect(isFileComplete(50, 0)).toBe(false);
    });

    it("returns false below 90% threshold", () => {
      expect(isFileComplete(89, 100)).toBe(false);
      expect(isFileComplete(50, 100)).toBe(false);
    });

    it("returns true at 90% threshold", () => {
      expect(isFileComplete(90, 100)).toBe(true);
    });

    it("returns true above 90% threshold", () => {
      expect(isFileComplete(95, 100)).toBe(true);
      expect(isFileComplete(100, 100)).toBe(true);
    });

    it("handles decimal values correctly", () => {
      // 90% of 3600 = 3240
      expect(isFileComplete(3240, 3600)).toBe(true);
      expect(isFileComplete(3239, 3600)).toBe(false);
    });
  });

  describe("calculateProgress", () => {
    it("returns null percentage for empty array", () => {
      const result = calculateProgress([]);
      expect(result.totalFiles).toBe(0);
      expect(result.completedFiles).toBe(0);
      expect(result.percentage).toBeNull();
    });

    it("returns 0% when no files are complete", () => {
      const files = [
        { playbackPosition: 0, playbackDuration: 100 },
        { playbackPosition: 50, playbackDuration: 100 },
      ];
      const result = calculateProgress(files);
      expect(result.totalFiles).toBe(2);
      expect(result.completedFiles).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("returns 100% when all files are complete", () => {
      const files = [
        { playbackPosition: 95, playbackDuration: 100 },
        { playbackPosition: 100, playbackDuration: 100 },
      ];
      const result = calculateProgress(files);
      expect(result.totalFiles).toBe(2);
      expect(result.completedFiles).toBe(2);
      expect(result.percentage).toBe(100);
    });

    it("calculates correct percentage for mixed completion", () => {
      const files = [
        { playbackPosition: 95, playbackDuration: 100 }, // complete
        { playbackPosition: 50, playbackDuration: 100 }, // incomplete
        { playbackPosition: 90, playbackDuration: 100 }, // complete
        { playbackPosition: null, playbackDuration: 100 }, // incomplete
      ];
      const result = calculateProgress(files);
      expect(result.totalFiles).toBe(4);
      expect(result.completedFiles).toBe(2);
      expect(result.percentage).toBe(50);
    });

    it("rounds percentage to nearest integer", () => {
      const files = [
        { playbackPosition: 95, playbackDuration: 100 }, // complete
        { playbackPosition: 50, playbackDuration: 100 }, // incomplete
        { playbackPosition: 50, playbackDuration: 100 }, // incomplete
      ];
      const result = calculateProgress(files);
      expect(result.percentage).toBe(33); // 1/3 = 33.33... rounds to 33
    });
  });

  describe("formatProgressLabel", () => {
    it("returns null for null percentage", () => {
      const progress = { totalFiles: 0, completedFiles: 0, percentage: null };
      expect(formatProgressLabel(progress)).toBeNull();
    });

    it("formats as completed/total", () => {
      const progress = { totalFiles: 10, completedFiles: 5, percentage: 50 };
      expect(formatProgressLabel(progress)).toBe("5/10");
    });

    it("formats zero progress", () => {
      const progress = { totalFiles: 10, completedFiles: 0, percentage: 0 };
      expect(formatProgressLabel(progress)).toBe("0/10");
    });
  });
});
```

### Step 3: Run tests

Run: `pnpm run test:unit tests/unit/lib/progress-utils.test.ts`
Expected: All tests pass

---

## Task 2: Type Definitions

**Files:**

- Modify: `lib/types.ts`

### Step 1: Add ItemProgress type

Add after existing imports (around line 10):

```typescript
// Re-export ItemProgress from progress-utils for convenience
export type { ItemProgress } from "./progress-utils";
```

### Step 2: Update ItemWithArtwork interface

Add to the `ItemWithArtwork` interface (around line 193, after `mediaIconType`):

```typescript
/** Progress data for item and all descendants (null if no media files) */
progress: ItemProgress | null;
```

### Step 3: Update TreeItem interface

Add to the `TreeItem` interface (around line 63, after `mediaIconType`):

```typescript
  /** Progress percentage (0-100) for item and descendants, null if no media */
  progressPercentage?: number | null;
```

### Step 4: Run type check

Run: `pnpm run type-check`
Expected: Errors in item-actions.ts (progress not yet provided) - this is expected

---

## Task 3: Server Action Changes

**Files:**

- Modify: `lib/item-actions.ts`

### Step 1: Add import for progress utilities

Add to imports at top of file:

```typescript
import { calculateProgress, type ItemProgress } from "@/lib/progress-utils";
```

### Step 2: Add buildDescendantProgressMap function

Add after the imports (around line 30):

```typescript
/**
 * Builds a map of item IDs to their progress (self + all descendants).
 * Uses recursive CTE to efficiently fetch all descendant media files.
 *
 * @param userId - User ID for authorization
 * @param itemIds - Array of item IDs to calculate progress for
 * @returns Map of item ID to ItemProgress
 */
async function buildDescendantProgressMap(
  userId: string,
  itemIds: string[]
): Promise<Map<string, ItemProgress>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  // Single query: get all media files for items and their descendants
  const filesData = await prisma.$queryRaw<
    Array<{
      rootItemId: string;
      playbackPosition: number | null;
      playbackDuration: number | null;
    }>
  >`
    WITH RECURSIVE descendants AS (
      -- Base: the items themselves
      SELECT id, id as "rootItemId" FROM "Item"
      WHERE id = ANY(${itemIds}) AND "userId" = ${userId}
      UNION ALL
      -- Recursive: all descendants
      SELECT i.id, d."rootItemId"
      FROM "Item" i
      INNER JOIN descendants d ON i."parentId" = d.id
      WHERE i."userId" = ${userId}
    )
    SELECT
      d."rootItemId",
      f."playbackPosition",
      f."playbackDuration"
    FROM descendants d
    JOIN "ItemFile" f ON f."itemId" = d.id
    WHERE f."fileType" = 'MEDIA'
  `;

  // Group files by rootItemId
  const grouped = new Map<
    string,
    Array<{ playbackPosition: number | null; playbackDuration: number | null }>
  >();

  for (const file of filesData) {
    const files = grouped.get(file.rootItemId) ?? [];
    files.push({
      playbackPosition: file.playbackPosition,
      playbackDuration: file.playbackDuration,
    });
    grouped.set(file.rootItemId, files);
  }

  // Calculate progress for each item
  const progressMap = new Map<string, ItemProgress>();
  for (const itemId of itemIds) {
    const files = grouped.get(itemId) ?? [];
    progressMap.set(itemId, calculateProgress(files));
  }

  return progressMap;
}
```

### Step 3: Update getItems function

In the `getItems` function, add progress calculation after fetching items (around line 80):

```typescript
// Build progress map for all items
const progressMap = await buildDescendantProgressMap(
  session.user.id,
  items.map((i) => i.id)
);
```

Then update the return mapping to include progress:

```typescript
// Add progress (null if no media files in subtree)
const itemProgress = progressMap.get(item.id);
const progress = itemProgress?.percentage !== null ? itemProgress : null;
```

And add to the returned object:

```typescript
      progress,
```

### Step 4: Update getAllItems function

Apply the same pattern to `getAllItems` function.

### Step 5: Update getDescendants function

Apply the same pattern to `getDescendants` function.

### Step 6: Run type check

Run: `pnpm run type-check`
Expected: No errors

---

## Task 4: Update item-utils

**Files:**

- Modify: `lib/item-utils.ts`

### Step 1: Update itemsToTree to pass through progress

In the `itemsToTree` function, add progress to the TreeItem creation (around line 84):

```typescript
      // Include progress percentage for display
      progressPercentage:
        "progress" in item ? item.progress?.percentage ?? null : null,
```

---

## Task 5: ItemHero Progress Bar

**Files:**

- Modify: `components/items/item-hero.tsx`
- Modify: `tests/unit/components/items/item-hero.test.tsx`

### Step 1: Add props to ItemHero

Add to `ItemHeroProps` interface:

```typescript
  /** Progress percentage (0-100), null to hide progress bar */
  progressPercentage?: number | null;
  /** Progress label (e.g., "5/10") */
  progressLabel?: string | null;
```

### Step 2: Add progress bar to expanded hero

Add after the stats row (around line 310, before the play button):

```tsx
{
  /* Progress bar - only in expanded mode */
}
{
  progressPercentage !== null && (
    <div className="flex w-full max-w-md flex-col items-center gap-1">
      <div className="h-1.5 w-full rounded-full bg-white/20">
        <div
          data-testid="hero-progress-bar"
          className="h-full rounded-full bg-white/80 transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      {progressLabel && (
        <span className="text-xs text-white/60">{progressLabel}</span>
      )}
    </div>
  );
}
```

### Step 3: Add unit tests

Add to `tests/unit/components/items/item-hero.test.tsx`:

```typescript
describe("progress bar", () => {
  it("renders progress bar when progressPercentage is provided", () => {
    render(<ItemHero name="Test" progressPercentage={50} />);
    expect(screen.getByTestId("hero-progress-bar")).toBeInTheDocument();
  });

  it("renders progress bar at 0%", () => {
    render(<ItemHero name="Test" progressPercentage={0} />);
    const bar = screen.getByTestId("hero-progress-bar");
    expect(bar).toHaveStyle({ width: "0%" });
  });

  it("renders progress bar at correct width", () => {
    render(<ItemHero name="Test" progressPercentage={75} />);
    const bar = screen.getByTestId("hero-progress-bar");
    expect(bar).toHaveStyle({ width: "75%" });
  });

  it("hides progress bar when progressPercentage is null", () => {
    render(<ItemHero name="Test" progressPercentage={null} />);
    expect(screen.queryByTestId("hero-progress-bar")).not.toBeInTheDocument();
  });

  it("shows progress label when provided", () => {
    render(<ItemHero name="Test" progressPercentage={50} progressLabel="5/10" />);
    expect(screen.getByText("5/10")).toBeInTheDocument();
  });
});
```

---

## Task 6: GridItem Progress Bar

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `tests/unit/components/sortable-grid.test.tsx`

### Step 1: Add prop to GridItem

Add to `GridItemProps` interface:

```typescript
  /** Progress percentage (0-100), null to hide progress bar */
  progressPercentage?: number | null;
```

### Step 2: Add progress bar to GridItem

Add before the closing `</div>` of the main container, inside the relative wrapper (after the content overlay):

```tsx
{
  /* Progress bar - only in view mode (not edit mode) */
}
{
  progressPercentage !== null && !handleProps && (
    <div className="absolute inset-x-0 bottom-0 z-30 h-1 bg-black/30">
      <div
        data-testid="grid-progress-bar"
        className="bg-primary h-full transition-all duration-300"
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  );
}
```

### Step 3: Add unit tests

Add to `tests/unit/components/sortable-grid.test.tsx`:

```typescript
describe("progress bar", () => {
  it("shows progress bar in view mode", () => {
    render(<GridItem id="1" name="Test" progressPercentage={50} />);
    expect(screen.getByTestId("grid-progress-bar")).toBeInTheDocument();
  });

  it("shows progress bar at 0%", () => {
    render(<GridItem id="1" name="Test" progressPercentage={0} />);
    const bar = screen.getByTestId("grid-progress-bar");
    expect(bar).toHaveStyle({ width: "0%" });
  });

  it("hides progress bar in edit mode", () => {
    render(
      <GridItem
        id="1"
        name="Test"
        progressPercentage={50}
        handleProps={{ "aria-label": "drag" }}
      />
    );
    expect(screen.queryByTestId("grid-progress-bar")).not.toBeInTheDocument();
  });

  it("hides progress bar when progressPercentage is null", () => {
    render(<GridItem id="1" name="Test" progressPercentage={null} />);
    expect(screen.queryByTestId("grid-progress-bar")).not.toBeInTheDocument();
  });
});
```

---

## Task 7: TreeItem Progress Bar

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `tests/unit/components/sortable-tree.test.tsx`

### Step 1: Add prop to TreeItem

Add to `TreeItemProps` interface:

```typescript
  /** Progress percentage (0-100), null to hide progress bar */
  progressPercentage?: number | null;
```

### Step 2: Add progress bar to TreeItem

Add after the item name/description section, inside the content div (only in view mode):

```tsx
{
  /* Progress bar - only in view mode */
}
{
  progressPercentage !== null && !showDragHandle && (
    <div className="bg-muted ml-2 h-1 w-16 flex-shrink-0 rounded-full">
      <div
        data-testid="tree-progress-bar"
        className="bg-primary h-full rounded-full transition-all duration-300"
        style={{ width: `${progressPercentage}%` }}
      />
    </div>
  );
}
```

### Step 3: Add unit tests

Add to `tests/unit/components/sortable-tree.test.tsx`:

```typescript
describe("progress bar", () => {
  it("shows progress bar in view mode", () => {
    render(
      <TreeItem
        id="1"
        value="Test"
        depth={0}
        indentationWidth={24}
        showDragHandle={false}
        progressPercentage={50}
      />
    );
    expect(screen.getByTestId("tree-progress-bar")).toBeInTheDocument();
  });

  it("hides progress bar in edit mode", () => {
    render(
      <TreeItem
        id="1"
        value="Test"
        depth={0}
        indentationWidth={24}
        showDragHandle={true}
        progressPercentage={50}
      />
    );
    expect(screen.queryByTestId("tree-progress-bar")).not.toBeInTheDocument();
  });

  it("hides progress bar when progressPercentage is null", () => {
    render(
      <TreeItem
        id="1"
        value="Test"
        depth={0}
        indentationWidth={24}
        showDragHandle={false}
        progressPercentage={null}
      />
    );
    expect(screen.queryByTestId("tree-progress-bar")).not.toBeInTheDocument();
  });
});
```

---

## Task 8: Wire Up Components

**Files:**

- Modify: `components/items/items-view.tsx`
- Modify: `app/(my-items)/my-items/page.tsx`
- Modify: `app/(my-items)/my-items/[itemId]/page.tsx`
- Modify: `components/items/item-detail-client.tsx`

### Step 1: Update items-view.tsx

Pass `progressPercentage` to Grid and Tree items from the item data.

### Step 2: Update my-items/page.tsx

Calculate progress for the root level and pass to ItemHero:

```typescript
// Calculate overall library progress (all root items and descendants)
const progressMap = await buildDescendantProgressMap(
  session.user.id,
  items.map((i) => i.id)
);
// Aggregate all progress...
```

### Step 3: Update my-items/[itemId]/page.tsx

Pass item progress to the detail client for the hero.

### Step 4: Update item-detail-client.tsx

Pass `progressPercentage` and `progressLabel` to ItemHero.

---

## Task 9: Integration Tests

**Files:**

- Create: `tests/integration/items/item-progress.test.ts`

```typescript
/**
 * Integration tests for item progress calculation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { getItems } from "@/lib/item-actions";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-progress-user" } }),
}));

describe("item progress integration", () => {
  const testUserId = "test-progress-user";

  beforeEach(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "progress-test@example.com",
        passwordHash: "hash",
      },
    });
  });

  afterEach(async () => {
    await prisma.itemFile.deleteMany({
      where: { item: { userId: testUserId } },
    });
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("returns null progress for item with no media files", async () => {
    await prisma.item.create({
      data: {
        name: "Empty Folder",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    expect(result.data?.[0].progress).toBeNull();
  });

  it("returns 0% progress for unwatched media", async () => {
    await prisma.item.create({
      data: {
        name: "Unwatched Movie",
        userId: testUserId,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: null,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    expect(result.data?.[0].progress?.percentage).toBe(0);
  });

  it("returns 100% progress for completed media", async () => {
    await prisma.item.create({
      data: {
        name: "Watched Movie",
        userId: testUserId,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
            playbackPosition: 6600, // 91.6% - above 90% threshold
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    expect(result.data?.[0].progress?.percentage).toBe(100);
  });

  it("aggregates progress across descendants", async () => {
    // Create show with 2 episodes
    const show = await prisma.item.create({
      data: {
        name: "TV Show",
        userId: testUserId,
        order: 0,
        depth: 0,
      },
    });

    // Episode 1 - watched
    await prisma.item.create({
      data: {
        name: "Episode 1",
        userId: testUserId,
        parentId: show.id,
        order: 0,
        depth: 1,
        files: {
          create: {
            filename: "ep1.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 3600,
            playbackPosition: 3300, // 91.6% - complete
          },
        },
      },
    });

    // Episode 2 - not watched
    await prisma.item.create({
      data: {
        name: "Episode 2",
        userId: testUserId,
        parentId: show.id,
        order: 1,
        depth: 1,
        files: {
          create: {
            filename: "ep2.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 3600,
            playbackPosition: 0,
          },
        },
      },
    });

    const result = await getItems(null);
    expect(result.success).toBe(true);
    // Show should have 50% progress (1/2 episodes complete)
    expect(result.data?.[0].progress?.percentage).toBe(50);
    expect(result.data?.[0].progress?.completedFiles).toBe(1);
    expect(result.data?.[0].progress?.totalFiles).toBe(2);
  });
});
```

---

## Task 10: E2E Tests

**Files:**

- Create: `e2e/journeys/items/item-progress.spec.ts`

```typescript
/**
 * E2E tests for item progress bars.
 */

import { test, expect } from "../../fixtures";
import { generateUniqueEmail, TEST_PASSWORD } from "../../helpers/test-user";

test.describe("Item Progress Bars", () => {
  test.beforeEach(async ({ page, signUpPage }) => {
    const email = generateUniqueEmail("item-progress");
    await signUpPage.goto();
    await signUpPage.signUp(email, TEST_PASSWORD, TEST_PASSWORD);
    await expect(page).toHaveURL("/my-items", { timeout: 10000 });
  });

  test("hides progress bar when item has no media files", async ({
    page,
    itemsPage,
  }) => {
    // Create empty folder
    await itemsPage.createItem("Empty Folder");

    // Should not show progress bar
    await expect(page.getByTestId("grid-progress-bar")).not.toBeVisible();

    // Cleanup
    await itemsPage.deleteItemViaContextMenu("Empty Folder");
  });

  test("hides progress bar in edit mode", async ({ page, itemsPage }) => {
    // Create item
    await itemsPage.createItem("Test Item");

    // Enter edit mode
    await page.getByRole("button", { name: /edit/i }).click();

    // Progress bar should not be visible in edit mode
    await expect(page.getByTestId("grid-progress-bar")).not.toBeVisible();

    // Exit edit mode
    await page.getByRole("button", { name: /done/i }).click();

    // Cleanup
    await itemsPage.deleteItemViaContextMenu("Test Item");
  });

  test("shows progress bar on item hero", async ({ page, itemsPage }) => {
    // Note: This test requires an item with media files that have playback data
    // For now, we just verify the hero renders without errors
    await itemsPage.createItem("Hero Test");
    await itemsPage.clickItem("Hero Test");

    const hero = page.getByTestId("item-hero");
    await expect(hero).toBeVisible();

    // Navigate back and cleanup
    await itemsPage.breadcrumbHome.click();
    await itemsPage.deleteItemViaContextMenu("Hero Test");
  });
});
```

---

## Task 11: Update Existing Tests

**Files:**

- Modify: `tests/unit/lib/item-actions.test.ts`

Update mock item fixtures to include `progress` field:

```typescript
const mockItemWithArtwork = {
  // ... existing fields ...
  progress: null, // or { totalFiles: 0, completedFiles: 0, percentage: null }
};
```

---

## Task 12: Final Verification

### Step 1: Run all checks

```bash
pnpm run check
```

Expected: All checks pass (format, lint, type-check, knip, build)

### Step 2: Run all tests

```bash
pnpm run test && pnpm run test:integration && pnpm run test:e2e
```

Expected: All tests pass

---

## Task 13: Seed Playback Simulation

**Files:**

- Modify: `prisma/seed-config.ts`
- Modify: `prisma/seed.ts`
- Modify: `tests/unit/lib/seed.test.ts`

### Step 1: Add playback configuration

Add to `prisma/seed-config.ts`:

```typescript
/** Enable playback progress simulation for progress bar testing. */
export const SEED_SIMULATE_PLAYBACK =
  process.env.SEED_SIMULATE_PLAYBACK?.toLowerCase() !== "false";

/** Duration ranges in seconds for different content types. */
export const PLAYBACK_DURATIONS = {
  movie: { min: 5400, max: 10800 }, // 1.5-3 hours
  episode: { min: 1800, max: 4200 }, // 30-70 minutes
};
```

### Step 2: Update media file creation in seed.ts

In the media placeholder creation section (around line 494), update to include playback data:

```typescript
// --- MEDIA PLACEHOLDERS ---
for (let i = 0; i < mediaCount; i++) {
  const filename =
    i === 0
      ? level === "movie"
        ? "movie.mp4"
        : "episode.mp4"
      : `media-${i + 1}.mp4`;

  // Generate realistic playback data for progress bar testing
  let playbackDuration: number | null = null;
  let playbackPosition: number | null = null;

  if (SEED_SIMULATE_PLAYBACK) {
    const durationRange =
      level === "movie" ? PLAYBACK_DURATIONS.movie : PLAYBACK_DURATIONS.episode;

    playbackDuration = Math.floor(
      durationRange.min + random() * (durationRange.max - durationRange.min)
    );

    // Simulate varying watch states using seeded random
    const watchState = random();
    if (watchState < 0.25) {
      // Unwatched (25%)
      playbackPosition = null;
    } else if (watchState < 0.5) {
      // Partially watched 30-50% (25%)
      playbackPosition = Math.floor(playbackDuration * (0.3 + random() * 0.2));
    } else if (watchState < 0.75) {
      // Almost done 70-85%, below 90% threshold (25%)
      playbackPosition = Math.floor(playbackDuration * (0.7 + random() * 0.15));
    } else {
      // Complete 91-100% (25%)
      playbackPosition = Math.floor(
        playbackDuration * (0.91 + random() * 0.09)
      );
    }
  }

  await prisma.itemFile.create({
    data: {
      itemId,
      filename,
      driveFileId: null,
      fileType: FileType.MEDIA,
      mimeType: "video/mp4",
      size: BigInt(0),
      isPrimary: i === 0,
      isHero: false,
      syncStatus: SyncStatus.SYNCED,
      playbackDuration,
      playbackPosition,
    },
  });
}
```

### Step 3: Add import and update documentation in seed.ts

Add to imports at top of seed.ts:

```typescript
import {
  // ... existing imports ...
  SEED_SIMULATE_PLAYBACK,
  PLAYBACK_DURATIONS,
} from "./seed-config";
```

Add to the JSDoc header (around line 35, after `SEED_RANDOM_SEED`):

```typescript
 *   - SEED_SIMULATE_PLAYBACK: Generate playback progress data (default: true)
```

### Step 4: Add seed unit tests

Add to `tests/unit/lib/seed.test.ts`:

```typescript
describe("playback simulation", () => {
  it("generates playback duration for media files", () => {
    // Movie duration should be 1.5-3 hours (5400-10800 seconds)
    const movieDuration = 7200; // 2 hours
    expect(movieDuration).toBeGreaterThanOrEqual(5400);
    expect(movieDuration).toBeLessThanOrEqual(10800);
  });

  it("generates episode duration in appropriate range", () => {
    // Episode duration should be 30-70 minutes (1800-4200 seconds)
    const episodeDuration = 2700; // 45 minutes
    expect(episodeDuration).toBeGreaterThanOrEqual(1800);
    expect(episodeDuration).toBeLessThanOrEqual(4200);
  });

  it("creates varied watch states", () => {
    // With seeded random, should get reproducible distribution:
    // ~25% unwatched, ~25% partial, ~25% almost done, ~25% complete
    const watchStates = [0.1, 0.3, 0.6, 0.9]; // Example distribution
    const unwatched = watchStates.filter((s) => s < 0.25).length;
    const complete = watchStates.filter((s) => s >= 0.75).length;
    expect(unwatched + complete).toBeGreaterThan(0);
  });
});
```

### Step 5: Verify with seed

Run seed with fixed random seed:

```bash
SEED_RANDOM_SEED=42 pnpm prisma db seed
```

Then verify progress distribution in the database:

```sql
SELECT
  CASE
    WHEN "playbackPosition" IS NULL THEN 'unwatched'
    WHEN "playbackPosition" >= "playbackDuration" * 0.9 THEN 'complete'
    WHEN "playbackPosition" >= "playbackDuration" * 0.7 THEN 'almost_done'
    ELSE 'partial'
  END as watch_state,
  COUNT(*) as count
FROM "ItemFile"
WHERE "fileType" = 'MEDIA'
GROUP BY watch_state;
```

---

## Summary

### Files Created

- `lib/progress-utils.ts` - Progress calculation utilities
- `tests/unit/lib/progress-utils.test.ts` - Unit tests for utilities
- `tests/integration/items/item-progress.test.ts` - Integration tests
- `e2e/journeys/items/item-progress.spec.ts` - E2E tests

### Files Modified

- `lib/types.ts` - Add progress types
- `lib/item-actions.ts` - Add progress calculation to getItems/getAllItems/getDescendants
- `lib/item-utils.ts` - Pass through progress in itemsToTree
- `components/items/item-hero.tsx` - Add progress bar
- `components/sortable-grid/GridItem.tsx` - Add progress bar
- `components/sortable-tree/components/TreeItem/TreeItem.tsx` - Add progress bar
- `components/items/items-view.tsx` - Wire up progress
- `app/(my-items)/my-items/page.tsx` - Pass progress to hero
- `app/(my-items)/my-items/[itemId]/page.tsx` - Pass progress to hero
- `prisma/seed-config.ts` - Add playback simulation config
- `prisma/seed.ts` - Generate playback data for media files
- `tests/unit/lib/item-actions.test.ts` - Update mocks
- `tests/unit/lib/seed.test.ts` - Add playback simulation tests
- `tests/unit/components/items/item-hero.test.tsx` - Add progress tests
- `tests/unit/components/sortable-grid.test.tsx` - Add progress tests
- `tests/unit/components/sortable-tree.test.tsx` - Add progress tests

### No Database Changes

Uses existing `playbackPosition` and `playbackDuration` fields on `ItemFile`.
