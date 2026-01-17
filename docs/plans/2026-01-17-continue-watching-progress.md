# Continue Watching & Progress Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Surface playback progress across the library with completion states (INCOMPLETE/COMPLETED/SKIPPED), hierarchical progress aggregation, and an "Up Next" feature that finds the first incomplete item in DFS order.

**Architecture:** Extends the existing `playbackPosition`/`playbackDuration` tracking with item-level completion states. Adds progress aggregation utilities for parent items (shows/collections). Implements a "Continue Watching" sidebar section showing items in progress, and "Up Next" navigation to quickly find the next incomplete item.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, Tailwind CSS 4, shadcn/ui

---

## Overview

### Current State
- `playbackPosition` and `playbackDuration` tracked at `ItemFile` level
- Media player auto-resumes from saved position
- "Resume" vs "Play" button shown in hero based on `hasProgress`
- No library-wide progress view
- No completion states (just position tracking)
- No "Up Next" feature

### Trakt-Inspired Approach
- **Continue Watching**: Items with playback progress, ordered by recent activity
- **Progress**: Watched/remaining counts at show level with visual progress bars
- **Up Next**: First incomplete item in DFS order
- **Completion States**: Mark items as completed/skipped

### Key Features
1. **Completion Status** on Item model (INCOMPLETE, COMPLETED, SKIPPED)
2. **Progress Aggregation** across item hierarchies (e.g., show progress = avg of episode progress)
3. **Up Next** DFS traversal to find first incomplete item with media
4. **Continue Watching** sidebar section showing items in progress
5. **Mark Complete/Skip** context menu actions

---

## Database Schema Changes

### New Enum: CompletionStatus
```prisma
enum CompletionStatus {
  INCOMPLETE    // Default - not started or in progress
  COMPLETED     // User finished watching or marked complete
  SKIPPED       // User explicitly skipped this item
}
```

### Item Model Updates
```prisma
model Item {
  // ... existing fields ...

  // Completion tracking
  completionStatus    CompletionStatus @default(INCOMPLETE)
  completedAt         DateTime?        // When status changed to COMPLETED
  lastWatchedAt       DateTime?        // Last time any media file was played

  @@index([userId, completionStatus])        // Query incomplete items
  @@index([userId, lastWatchedAt])           // Order by recent activity
}
```

---

## Task 1: Database Migration

**Files:**
- Create: `prisma/migrations/[timestamp]_add_completion_status/migration.sql`
- Modify: `prisma/schema.prisma:122-165`

**Step 1: Update Prisma schema**

Add to `prisma/schema.prisma` after the `SyncLogStatus` enum (around line 35):

```prisma
enum CompletionStatus {
  INCOMPLETE
  COMPLETED
  SKIPPED
}
```

Add to the `Item` model (around line 140, before the `@@index` declarations):

```prisma
  // Completion tracking
  completionStatus    CompletionStatus @default(INCOMPLETE)
  completedAt         DateTime?
  lastWatchedAt       DateTime?
```

Add indexes after existing indexes (around line 160):

```prisma
  @@index([userId, completionStatus])
  @@index([userId, lastWatchedAt])
```

**Step 2: Generate and run migration**

Run: `npx prisma migrate dev --name add_completion_status`
Expected: Migration created and applied successfully

**Step 3: Verify migration**

Run: `npx prisma db pull && npx prisma generate`
Expected: Schema matches database

**Step 4: Commit**

```bash
git add prisma/
git commit -m "$(cat <<'EOF'
feat(db): add completion status tracking to Item model

Adds CompletionStatus enum (INCOMPLETE, COMPLETED, SKIPPED) and
tracking fields (completedAt, lastWatchedAt) for progress feature.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Type Definitions

**Files:**
- Modify: `lib/types.ts`

**Step 1: Add CompletionStatus type and re-export**

Add after the existing `SyncStatus` re-export (around line 9):

```typescript
// Re-export CompletionStatus enum for client-side use
export { CompletionStatus } from "@prisma/client";
```

**Step 2: Update Item interface**

Add to the `Item` interface (around line 35, before `userId`):

```typescript
  // Completion tracking
  completionStatus: CompletionStatus;
  completedAt: Date | null;
  lastWatchedAt: Date | null;
```

**Step 3: Add progress-related types**

Add after the `PinnedItem` interface (around line 243):

```typescript
/**
 * Progress data for an item or item hierarchy.
 * Used by progress aggregation utilities.
 */
export interface ItemProgress {
  /** Total number of media files in item and descendants */
  totalFiles: number;
  /** Number of completed files (position >= 90% of duration) */
  completedFiles: number;
  /** Number of in-progress files (0 < position < 90%) */
  inProgressFiles: number;
  /** Completion percentage (0-100) */
  percentage: number;
  /** Overall completion status based on child states */
  aggregatedStatus: CompletionStatus;
}

/**
 * Item with progress data for Continue Watching display.
 * Includes recent activity timestamp for ordering.
 */
export interface ContinueWatchingItem {
  id: string;
  name: string;
  description: string | null;
  artworkId: string | null;
  /** Parent breadcrumb path (e.g., "Breaking Bad / Season 1") */
  breadcrumb: string | null;
  /** Most recent playback activity */
  lastWatchedAt: Date;
  /** Progress percentage (0-100) */
  progressPercentage: number;
  /** Current file being watched */
  currentFileName: string | null;
  /** Position in current file (seconds) */
  currentPosition: number | null;
  /** Duration of current file (seconds) */
  currentDuration: number | null;
}

/**
 * Up Next item - the first incomplete item in DFS order.
 */
export interface UpNextItem {
  id: string;
  name: string;
  artworkId: string | null;
  /** Parent breadcrumb path */
  breadcrumb: string | null;
  /** Primary media file to play */
  fileId: string;
  fileName: string;
  /** Resume position (0 if not started) */
  position: number;
}
```

**Step 4: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add lib/types.ts
git commit -m "$(cat <<'EOF'
feat(types): add progress and completion tracking types

Adds CompletionStatus re-export, ItemProgress for aggregation,
ContinueWatchingItem for sidebar display, and UpNextItem for
quick navigation to next incomplete item.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Progress Calculation Utilities

**Files:**
- Create: `lib/progress-utils.ts`
- Create: `tests/unit/lib/progress-utils.test.ts`

**Step 1: Write failing tests for progress calculation**

Create `tests/unit/lib/progress-utils.test.ts`:

```typescript
/**
 * Unit tests for progress calculation utilities.
 */

import { describe, it, expect } from "vitest";
import {
  calculateFileProgress,
  isFileComplete,
  calculateItemProgress,
  findUpNextItem,
  COMPLETION_THRESHOLD,
} from "@/lib/progress-utils";
import type { CompletionStatus } from "@prisma/client";

describe("progress-utils", () => {
  describe("calculateFileProgress", () => {
    it("returns 0 for null position", () => {
      expect(calculateFileProgress(null, 100)).toBe(0);
    });

    it("returns 0 for null duration", () => {
      expect(calculateFileProgress(50, null)).toBe(0);
    });

    it("returns 0 for zero duration", () => {
      expect(calculateFileProgress(50, 0)).toBe(0);
    });

    it("calculates percentage correctly", () => {
      expect(calculateFileProgress(50, 100)).toBe(50);
      expect(calculateFileProgress(25, 100)).toBe(25);
      expect(calculateFileProgress(90, 100)).toBe(90);
    });

    it("caps at 100%", () => {
      expect(calculateFileProgress(150, 100)).toBe(100);
    });

    it("handles decimal positions", () => {
      expect(calculateFileProgress(33.33, 100)).toBeCloseTo(33.33, 1);
    });
  });

  describe("isFileComplete", () => {
    it("returns false for null position", () => {
      expect(isFileComplete(null, 100)).toBe(false);
    });

    it("returns false for null duration", () => {
      expect(isFileComplete(50, null)).toBe(false);
    });

    it("returns true at completion threshold", () => {
      // Default threshold is 90%
      expect(isFileComplete(90, 100)).toBe(true);
      expect(isFileComplete(89, 100)).toBe(false);
    });

    it("returns true above threshold", () => {
      expect(isFileComplete(95, 100)).toBe(true);
      expect(isFileComplete(100, 100)).toBe(true);
    });
  });

  describe("calculateItemProgress", () => {
    const makeFile = (
      position: number | null,
      duration: number | null
    ) => ({
      playbackPosition: position,
      playbackDuration: duration,
    });

    it("returns zero progress for no files", () => {
      const result = calculateItemProgress([], "INCOMPLETE");
      expect(result.totalFiles).toBe(0);
      expect(result.percentage).toBe(0);
      expect(result.aggregatedStatus).toBe("INCOMPLETE");
    });

    it("calculates progress for single incomplete file", () => {
      const files = [makeFile(50, 100)];
      const result = calculateItemProgress(files, "INCOMPLETE");
      expect(result.totalFiles).toBe(1);
      expect(result.completedFiles).toBe(0);
      expect(result.inProgressFiles).toBe(1);
      expect(result.percentage).toBe(50);
    });

    it("calculates progress for single complete file", () => {
      const files = [makeFile(95, 100)];
      const result = calculateItemProgress(files, "INCOMPLETE");
      expect(result.totalFiles).toBe(1);
      expect(result.completedFiles).toBe(1);
      expect(result.percentage).toBe(95);
    });

    it("calculates average progress for multiple files", () => {
      const files = [
        makeFile(100, 100), // 100%
        makeFile(50, 100),  // 50%
        makeFile(0, 100),   // 0%
      ];
      const result = calculateItemProgress(files, "INCOMPLETE");
      expect(result.totalFiles).toBe(3);
      expect(result.completedFiles).toBe(1);
      expect(result.inProgressFiles).toBe(1);
      expect(result.percentage).toBe(50); // (100+50+0)/3
    });

    it("respects explicit completion status", () => {
      const files = [makeFile(50, 100)];
      const completed = calculateItemProgress(files, "COMPLETED");
      expect(completed.aggregatedStatus).toBe("COMPLETED");

      const skipped = calculateItemProgress(files, "SKIPPED");
      expect(skipped.aggregatedStatus).toBe("SKIPPED");
    });

    it("auto-completes when all files complete", () => {
      const files = [
        makeFile(95, 100),
        makeFile(100, 100),
      ];
      const result = calculateItemProgress(files, "INCOMPLETE");
      expect(result.aggregatedStatus).toBe("COMPLETED");
    });
  });

  describe("findUpNextItem", () => {
    interface TestItem {
      id: string;
      name: string;
      completionStatus: CompletionStatus;
      children: TestItem[];
      files: { playbackPosition: number | null; playbackDuration: number | null }[];
    }

    const makeItem = (
      id: string,
      status: CompletionStatus,
      files: { pos: number | null; dur: number | null }[] = [],
      children: TestItem[] = []
    ): TestItem => ({
      id,
      name: `Item ${id}`,
      completionStatus: status,
      children,
      files: files.map((f) => ({
        playbackPosition: f.pos,
        playbackDuration: f.dur,
      })),
    });

    it("returns null for empty tree", () => {
      expect(findUpNextItem([])).toBeNull();
    });

    it("returns null when all items are complete", () => {
      const items = [
        makeItem("1", "COMPLETED", [{ pos: 100, dur: 100 }]),
        makeItem("2", "COMPLETED", [{ pos: 100, dur: 100 }]),
      ];
      expect(findUpNextItem(items)).toBeNull();
    });

    it("returns null when all items are skipped", () => {
      const items = [
        makeItem("1", "SKIPPED"),
        makeItem("2", "SKIPPED"),
      ];
      expect(findUpNextItem(items)).toBeNull();
    });

    it("finds first incomplete item with media", () => {
      const items = [
        makeItem("1", "INCOMPLETE"), // No media
        makeItem("2", "INCOMPLETE", [{ pos: null, dur: 100 }]), // Has media
      ];
      const result = findUpNextItem(items);
      expect(result?.id).toBe("2");
    });

    it("traverses children in DFS order", () => {
      const items = [
        makeItem("1", "INCOMPLETE", [], [
          makeItem("1.1", "COMPLETED", [{ pos: 100, dur: 100 }]),
          makeItem("1.2", "INCOMPLETE", [{ pos: 50, dur: 100 }]), // First incomplete
          makeItem("1.3", "INCOMPLETE", [{ pos: null, dur: 100 }]),
        ]),
        makeItem("2", "INCOMPLETE", [{ pos: null, dur: 100 }]),
      ];
      const result = findUpNextItem(items);
      expect(result?.id).toBe("1.2");
    });

    it("skips completed and skipped items", () => {
      const items = [
        makeItem("1", "COMPLETED", [{ pos: 100, dur: 100 }]),
        makeItem("2", "SKIPPED"),
        makeItem("3", "INCOMPLETE", [{ pos: 0, dur: 100 }]),
      ];
      const result = findUpNextItem(items);
      expect(result?.id).toBe("3");
    });

    it("prefers in-progress over not-started", () => {
      const items = [
        makeItem("1", "INCOMPLETE", [{ pos: null, dur: 100 }]), // Not started
        makeItem("2", "INCOMPLETE", [{ pos: 50, dur: 100 }]),   // In progress
      ];
      // DFS order means we still get "1" first, but it has no progress
      // The function should return the first incomplete with media
      const result = findUpNextItem(items);
      expect(result?.id).toBe("1");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/progress-utils.test.ts`
Expected: FAIL - module not found

**Step 3: Implement progress utilities**

Create `lib/progress-utils.ts`:

```typescript
/**
 * Utilities for calculating playback progress and completion status.
 * Used for Continue Watching, Up Next, and progress aggregation.
 */

import type { CompletionStatus } from "@prisma/client";
import type { ItemProgress } from "./types";

/** Percentage threshold to consider a file complete (90%). */
export const COMPLETION_THRESHOLD = 90;

/**
 * Calculates playback progress percentage for a single file.
 *
 * @param position - Current playback position in seconds
 * @param duration - Total duration in seconds
 * @returns Progress percentage (0-100)
 */
export function calculateFileProgress(
  position: number | null,
  duration: number | null
): number {
  if (position === null || duration === null || duration === 0) {
    return 0;
  }
  const percentage = (position / duration) * 100;
  return Math.min(percentage, 100);
}

/**
 * Determines if a file is considered complete (>= 90% watched).
 *
 * @param position - Current playback position in seconds
 * @param duration - Total duration in seconds
 * @returns True if file is complete
 */
export function isFileComplete(
  position: number | null,
  duration: number | null
): boolean {
  return calculateFileProgress(position, duration) >= COMPLETION_THRESHOLD;
}

/**
 * File with playback data for progress calculation.
 */
interface FileWithProgress {
  playbackPosition: number | null;
  playbackDuration: number | null;
}

/**
 * Calculates aggregate progress for an item based on its media files.
 *
 * @param files - Array of files with playback data
 * @param explicitStatus - Item's explicit completion status
 * @returns Aggregated progress data
 */
export function calculateItemProgress(
  files: FileWithProgress[],
  explicitStatus: CompletionStatus
): ItemProgress {
  if (files.length === 0) {
    return {
      totalFiles: 0,
      completedFiles: 0,
      inProgressFiles: 0,
      percentage: 0,
      aggregatedStatus: explicitStatus,
    };
  }

  let totalPercentage = 0;
  let completedFiles = 0;
  let inProgressFiles = 0;

  for (const file of files) {
    const progress = calculateFileProgress(
      file.playbackPosition,
      file.playbackDuration
    );
    totalPercentage += progress;

    if (isFileComplete(file.playbackPosition, file.playbackDuration)) {
      completedFiles++;
    } else if (file.playbackPosition && file.playbackPosition > 0) {
      inProgressFiles++;
    }
  }

  const percentage = totalPercentage / files.length;

  // Determine aggregated status
  let aggregatedStatus: CompletionStatus = explicitStatus;
  if (explicitStatus === "INCOMPLETE" && completedFiles === files.length) {
    aggregatedStatus = "COMPLETED";
  }

  return {
    totalFiles: files.length,
    completedFiles,
    inProgressFiles,
    percentage,
    aggregatedStatus,
  };
}

/**
 * Item structure for Up Next traversal.
 */
interface UpNextTraversalItem {
  id: string;
  name: string;
  completionStatus: CompletionStatus;
  children: UpNextTraversalItem[];
  files: FileWithProgress[];
}

/**
 * Result from findUpNextItem.
 */
interface UpNextResult {
  id: string;
  name: string;
}

/**
 * Finds the first incomplete item with media files using DFS traversal.
 * Skips items marked as COMPLETED or SKIPPED.
 *
 * @param items - Tree of items to search
 * @returns First incomplete item with media, or null if none found
 */
export function findUpNextItem(
  items: UpNextTraversalItem[]
): UpNextResult | null {
  for (const item of items) {
    // Skip completed and skipped items
    if (
      item.completionStatus === "COMPLETED" ||
      item.completionStatus === "SKIPPED"
    ) {
      continue;
    }

    // Check if this item has incomplete media files
    const hasMedia = item.files.length > 0;
    const hasIncompleteMedia =
      hasMedia &&
      item.files.some(
        (f) => !isFileComplete(f.playbackPosition, f.playbackDuration)
      );

    if (hasIncompleteMedia) {
      return { id: item.id, name: item.name };
    }

    // Recurse into children (DFS)
    if (item.children.length > 0) {
      const childResult = findUpNextItem(item.children);
      if (childResult) {
        return childResult;
      }
    }

    // If item has media but all complete, continue to next sibling
    // If item has no media, continue to next sibling
  }

  return null;
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/lib/progress-utils.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/progress-utils.ts tests/unit/lib/progress-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(lib): add progress calculation utilities

Implements calculateFileProgress, isFileComplete, calculateItemProgress,
and findUpNextItem for Continue Watching and Up Next features.
Uses 90% completion threshold.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Server Actions for Completion Status

**Files:**
- Modify: `lib/item-actions.ts`
- Create: `tests/unit/lib/item-actions-completion.test.ts`

**Step 1: Write failing tests for completion actions**

Create `tests/unit/lib/item-actions-completion.test.ts`:

```typescript
/**
 * Unit tests for item completion status server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  markItemComplete,
  markItemSkipped,
  markItemIncomplete,
} from "@/lib/item-actions";
import { prismaMock } from "@/tests/unit/setup";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const authMock = vi.mocked(auth);

describe("completion status actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("markItemComplete", () => {
    it("returns error when not authenticated", async () => {
      authMock.mockResolvedValue(null);
      const result = await markItemComplete("item-1");
      expect(result).toEqual({ error: "Unauthorized" });
    });

    it("returns error when item not found", async () => {
      authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
      prismaMock.item.findUnique.mockResolvedValue(null);

      const result = await markItemComplete("item-1");
      expect(result).toEqual({ error: "Item not found" });
    });

    it("returns error when user does not own item", async () => {
      authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
      prismaMock.item.findUnique.mockResolvedValue({
        id: "item-1",
        userId: "user-2",
      } as never);

      const result = await markItemComplete("item-1");
      expect(result).toEqual({ error: "Access denied" });
    });

    it("updates item to COMPLETED status", async () => {
      authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
      prismaMock.item.findUnique.mockResolvedValue({
        id: "item-1",
        userId: "user-1",
      } as never);
      prismaMock.item.update.mockResolvedValue({ id: "item-1" } as never);

      const result = await markItemComplete("item-1");

      expect(result).toEqual({ success: true });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          completionStatus: "COMPLETED",
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe("markItemSkipped", () => {
    it("updates item to SKIPPED status", async () => {
      authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
      prismaMock.item.findUnique.mockResolvedValue({
        id: "item-1",
        userId: "user-1",
      } as never);
      prismaMock.item.update.mockResolvedValue({ id: "item-1" } as never);

      const result = await markItemSkipped("item-1");

      expect(result).toEqual({ success: true });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          completionStatus: "SKIPPED",
          completedAt: null,
        },
      });
    });
  });

  describe("markItemIncomplete", () => {
    it("resets item to INCOMPLETE status", async () => {
      authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
      prismaMock.item.findUnique.mockResolvedValue({
        id: "item-1",
        userId: "user-1",
      } as never);
      prismaMock.item.update.mockResolvedValue({ id: "item-1" } as never);

      const result = await markItemIncomplete("item-1");

      expect(result).toEqual({ success: true });
      expect(prismaMock.item.update).toHaveBeenCalledWith({
        where: { id: "item-1" },
        data: {
          completionStatus: "INCOMPLETE",
          completedAt: null,
        },
      });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/item-actions-completion.test.ts`
Expected: FAIL - functions not exported

**Step 3: Implement completion status actions**

Add to `lib/item-actions.ts` (after the existing `unpinItem` function):

```typescript
/**
 * Marks an item as completed.
 *
 * @param id - Item ID to mark complete
 * @returns Success or error result
 */
export async function markItemComplete(id: string): Promise<ItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    // Verify ownership
    const item = await prisma.item.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!item) {
      return { error: "Item not found" };
    }

    if (item.userId !== session.user.id) {
      return { error: "Access denied" };
    }

    await prisma.item.update({
      where: { id },
      data: {
        completionStatus: "COMPLETED",
        completedAt: new Date(),
      },
    });

    revalidatePath("/my-items", "layout");
    return { success: true };
  } catch (error) {
    logger.error({ error, itemId: id }, "Failed to mark item complete");
    return { error: "Failed to mark item complete" };
  }
}

/**
 * Marks an item as skipped (user doesn't want to watch).
 *
 * @param id - Item ID to mark skipped
 * @returns Success or error result
 */
export async function markItemSkipped(id: string): Promise<ItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    // Verify ownership
    const item = await prisma.item.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!item) {
      return { error: "Item not found" };
    }

    if (item.userId !== session.user.id) {
      return { error: "Access denied" };
    }

    await prisma.item.update({
      where: { id },
      data: {
        completionStatus: "SKIPPED",
        completedAt: null,
      },
    });

    revalidatePath("/my-items", "layout");
    return { success: true };
  } catch (error) {
    logger.error({ error, itemId: id }, "Failed to mark item skipped");
    return { error: "Failed to mark item skipped" };
  }
}

/**
 * Resets an item to incomplete status.
 *
 * @param id - Item ID to mark incomplete
 * @returns Success or error result
 */
export async function markItemIncomplete(id: string): Promise<ItemResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    // Verify ownership
    const item = await prisma.item.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!item) {
      return { error: "Item not found" };
    }

    if (item.userId !== session.user.id) {
      return { error: "Access denied" };
    }

    await prisma.item.update({
      where: { id },
      data: {
        completionStatus: "INCOMPLETE",
        completedAt: null,
      },
    });

    revalidatePath("/my-items", "layout");
    return { success: true };
  } catch (error) {
    logger.error({ error, itemId: id }, "Failed to mark item incomplete");
    return { error: "Failed to mark item incomplete" };
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/lib/item-actions-completion.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions-completion.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): add completion status server actions

Implements markItemComplete, markItemSkipped, and markItemIncomplete
for user-controlled completion state management.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update lastWatchedAt on Playback

**Files:**
- Modify: `lib/item-file-actions.ts`
- Modify: `tests/unit/lib/item-file-actions.test.ts`

**Step 1: Write failing test for lastWatchedAt update**

Add to `tests/unit/lib/item-file-actions.test.ts` in the `updatePlaybackPosition` describe block:

```typescript
it("updates parent item lastWatchedAt timestamp", async () => {
  authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
  prismaMock.itemFile.findUnique.mockResolvedValue({
    id: "file-1",
    itemId: "item-1",
    item: { userId: "user-1" },
  } as never);
  prismaMock.itemFile.update.mockResolvedValue({ id: "file-1" } as never);
  prismaMock.item.update.mockResolvedValue({ id: "item-1" } as never);

  await updatePlaybackPosition("file-1", 50, 100);

  expect(prismaMock.item.update).toHaveBeenCalledWith({
    where: { id: "item-1" },
    data: { lastWatchedAt: expect.any(Date) },
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm run test:unit tests/unit/lib/item-file-actions.test.ts -t "updates parent item lastWatchedAt"`
Expected: FAIL - item.update not called

**Step 3: Update updatePlaybackPosition to set lastWatchedAt**

Modify `lib/item-file-actions.ts` `updatePlaybackPosition` function to add after the `itemFile.update`:

```typescript
// Update parent item's lastWatchedAt
await prisma.item.update({
  where: { id: file.itemId },
  data: { lastWatchedAt: new Date() },
});
```

**Step 4: Run test to verify it passes**

Run: `pnpm run test:unit tests/unit/lib/item-file-actions.test.ts -t "updates parent item lastWatchedAt"`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/item-file-actions.ts tests/unit/lib/item-file-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): update lastWatchedAt on playback position change

Tracks recent viewing activity for Continue Watching ordering.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Continue Watching Server Action

**Files:**
- Modify: `lib/item-actions.ts`
- Create: `tests/unit/lib/item-actions-continue-watching.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/lib/item-actions-continue-watching.test.ts`:

```typescript
/**
 * Unit tests for getContinueWatching server action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getContinueWatching } from "@/lib/item-actions";
import { prismaMock } from "@/tests/unit/setup";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const authMock = vi.mocked(auth);

describe("getContinueWatching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const result = await getContinueWatching();
    expect(result).toEqual([]);
  });

  it("returns items with playback progress ordered by lastWatchedAt", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } } as never);

    const mockItems = [
      {
        id: "item-2",
        name: "Recent Show",
        description: null,
        lastWatchedAt: new Date("2026-01-17T12:00:00Z"),
        files: [
          {
            id: "file-2",
            filename: "episode.mkv",
            playbackPosition: 1800,
            playbackDuration: 3600,
            isPrimary: true,
            fileType: "MEDIA",
          },
        ],
        parent: null,
      },
      {
        id: "item-1",
        name: "Old Movie",
        description: "A classic",
        lastWatchedAt: new Date("2026-01-16T12:00:00Z"),
        files: [
          {
            id: "file-1",
            filename: "movie.mkv",
            playbackPosition: 600,
            playbackDuration: 7200,
            isPrimary: true,
            fileType: "MEDIA",
          },
        ],
        parent: { name: "Movies" },
      },
    ];

    prismaMock.item.findMany.mockResolvedValue(mockItems as never);

    const result = await getContinueWatching();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("item-2"); // More recent
    expect(result[0].progressPercentage).toBe(50);
    expect(result[1].id).toBe("item-1");
    expect(result[1].breadcrumb).toBe("Movies");
  });

  it("excludes items with no playback progress", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } } as never);

    const mockItems = [
      {
        id: "item-1",
        name: "Not Started",
        description: null,
        lastWatchedAt: null,
        files: [
          {
            id: "file-1",
            filename: "movie.mkv",
            playbackPosition: null,
            playbackDuration: 7200,
            isPrimary: true,
            fileType: "MEDIA",
          },
        ],
        parent: null,
      },
    ];

    prismaMock.item.findMany.mockResolvedValue(mockItems as never);

    const result = await getContinueWatching();

    expect(result).toHaveLength(0);
  });

  it("limits results to 10 items", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } } as never);

    prismaMock.item.findMany.mockResolvedValue([]);

    await getContinueWatching();

    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      })
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/item-actions-continue-watching.test.ts`
Expected: FAIL - function not exported

**Step 3: Implement getContinueWatching**

Add to `lib/item-actions.ts`:

```typescript
import type { ContinueWatchingItem } from "./types";
import { calculateFileProgress } from "./progress-utils";

/**
 * Gets items the user is currently watching (has playback progress).
 * Returns up to 10 items ordered by most recent activity.
 *
 * @returns Array of ContinueWatchingItem for sidebar display
 */
export async function getContinueWatching(): Promise<ContinueWatchingItem[]> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return [];
    }

    const items = await prisma.item.findMany({
      where: {
        userId: session.user.id,
        completionStatus: "INCOMPLETE",
        lastWatchedAt: { not: null },
        files: {
          some: {
            fileType: "MEDIA",
            playbackPosition: { gt: 0 },
          },
        },
      },
      orderBy: { lastWatchedAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        description: true,
        lastWatchedAt: true,
        parent: {
          select: { name: true },
        },
        files: {
          where: { fileType: "MEDIA" },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          take: 1,
          select: {
            id: true,
            filename: true,
            playbackPosition: true,
            playbackDuration: true,
          },
        },
      },
    });

    // Also fetch artwork separately (first artwork file)
    const itemIds = items.map((i) => i.id);
    const artworkMap = new Map<string, string>();

    if (itemIds.length > 0) {
      const artworks = await prisma.itemFile.findMany({
        where: {
          itemId: { in: itemIds },
          fileType: "ARTWORK",
          driveFileId: { not: null },
        },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          itemId: true,
          driveFileId: true,
        },
      });

      for (const art of artworks) {
        if (!artworkMap.has(art.itemId) && art.driveFileId) {
          artworkMap.set(art.itemId, art.driveFileId);
        }
      }
    }

    return items
      .filter((item) => item.files.length > 0 && item.lastWatchedAt)
      .map((item) => {
        const file = item.files[0];
        const progress = calculateFileProgress(
          file.playbackPosition,
          file.playbackDuration
        );

        return {
          id: item.id,
          name: item.name,
          description: item.description,
          artworkId: artworkMap.get(item.id) ?? null,
          breadcrumb: item.parent?.name ?? null,
          lastWatchedAt: item.lastWatchedAt!,
          progressPercentage: Math.round(progress),
          currentFileName: file.filename,
          currentPosition: file.playbackPosition,
          currentDuration: file.playbackDuration,
        };
      });
  } catch (error) {
    logger.error({ error }, "Failed to get continue watching items");
    return [];
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/lib/item-actions-continue-watching.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions-continue-watching.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): add getContinueWatching server action

Returns up to 10 items with playback progress, ordered by recent
activity, for Continue Watching sidebar section.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Up Next Server Action

**Files:**
- Modify: `lib/item-actions.ts`
- Create: `tests/unit/lib/item-actions-up-next.test.ts`

**Step 1: Write failing tests**

Create `tests/unit/lib/item-actions-up-next.test.ts`:

```typescript
/**
 * Unit tests for getUpNext server action.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUpNext } from "@/lib/item-actions";
import { prismaMock } from "@/tests/unit/setup";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const authMock = vi.mocked(auth);

describe("getUpNext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not authenticated", async () => {
    authMock.mockResolvedValue(null);
    const result = await getUpNext();
    expect(result).toBeNull();
  });

  it("returns null when no incomplete items with media", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } } as never);
    prismaMock.item.findMany.mockResolvedValue([]);

    const result = await getUpNext();
    expect(result).toBeNull();
  });

  it("returns first incomplete item with media in DFS order", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } } as never);

    const mockItems = [
      {
        id: "show-1",
        name: "Breaking Bad",
        completionStatus: "INCOMPLETE",
        parentId: null,
        order: 0,
        files: [],
      },
      {
        id: "season-1",
        name: "Season 1",
        completionStatus: "INCOMPLETE",
        parentId: "show-1",
        order: 0,
        files: [],
      },
      {
        id: "ep-1",
        name: "Pilot",
        completionStatus: "COMPLETED",
        parentId: "season-1",
        order: 0,
        files: [{ playbackPosition: 3600, playbackDuration: 3600 }],
      },
      {
        id: "ep-2",
        name: "Cat's in the Bag",
        completionStatus: "INCOMPLETE",
        parentId: "season-1",
        order: 1,
        files: [{ playbackPosition: 1200, playbackDuration: 2700 }],
      },
    ];

    prismaMock.item.findMany.mockResolvedValue(mockItems as never);

    // Mock for file lookup
    prismaMock.itemFile.findFirst.mockResolvedValue({
      id: "file-2",
      filename: "cats-in-the-bag.mkv",
      playbackPosition: 1200,
    } as never);

    // Mock for artwork
    prismaMock.itemFile.findFirst.mockResolvedValueOnce({
      driveFileId: "art-123",
    } as never);

    const result = await getUpNext();

    expect(result).not.toBeNull();
    expect(result?.id).toBe("ep-2");
    expect(result?.name).toBe("Cat's in the Bag");
  });

  it("skips completed and skipped items", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } } as never);

    const mockItems = [
      {
        id: "item-1",
        name: "Completed Movie",
        completionStatus: "COMPLETED",
        parentId: null,
        order: 0,
        files: [{ playbackPosition: 7200, playbackDuration: 7200 }],
      },
      {
        id: "item-2",
        name: "Skipped Show",
        completionStatus: "SKIPPED",
        parentId: null,
        order: 1,
        files: [{ playbackPosition: null, playbackDuration: 2700 }],
      },
      {
        id: "item-3",
        name: "Next Movie",
        completionStatus: "INCOMPLETE",
        parentId: null,
        order: 2,
        files: [{ playbackPosition: 0, playbackDuration: 5400 }],
      },
    ];

    prismaMock.item.findMany.mockResolvedValue(mockItems as never);
    prismaMock.itemFile.findFirst.mockResolvedValue({
      id: "file-3",
      filename: "next-movie.mkv",
      playbackPosition: 0,
    } as never);

    const result = await getUpNext();

    expect(result?.id).toBe("item-3");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/lib/item-actions-up-next.test.ts`
Expected: FAIL - function not exported

**Step 3: Implement getUpNext**

Add to `lib/item-actions.ts`:

```typescript
import type { UpNextItem } from "./types";
import { findUpNextItem } from "./progress-utils";
import { itemsToTree } from "./item-utils";

/**
 * Gets the next item the user should watch using DFS traversal.
 * Finds the first incomplete item with media files.
 *
 * @param parentId - Optional parent ID to scope search (default: entire library)
 * @returns UpNextItem or null if nothing to watch
 */
export async function getUpNext(
  parentId?: string | null
): Promise<UpNextItem | null> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    // Fetch all items for tree building
    const items = await prisma.item.findMany({
      where: {
        userId: session.user.id,
        ...(parentId !== undefined && { parentId }),
      },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        parentId: true,
        order: true,
        completionStatus: true,
        files: {
          where: { fileType: "MEDIA" },
          select: {
            playbackPosition: true,
            playbackDuration: true,
          },
        },
      },
    });

    if (items.length === 0) {
      return null;
    }

    // Build tree structure for DFS
    const treeItems = buildTreeForUpNext(items);
    const upNextResult = findUpNextItem(treeItems);

    if (!upNextResult) {
      return null;
    }

    // Fetch additional details for the found item
    const file = await prisma.itemFile.findFirst({
      where: {
        itemId: upNextResult.id,
        fileType: "MEDIA",
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        filename: true,
        playbackPosition: true,
      },
    });

    if (!file) {
      return null;
    }

    // Get artwork
    const artwork = await prisma.itemFile.findFirst({
      where: {
        itemId: upNextResult.id,
        fileType: "ARTWORK",
        driveFileId: { not: null },
      },
      select: { driveFileId: true },
    });

    // Build breadcrumb
    const item = items.find((i) => i.id === upNextResult.id);
    let breadcrumb: string | null = null;

    if (item?.parentId) {
      const ancestors: string[] = [];
      let currentId: string | null = item.parentId;

      while (currentId) {
        const parent = items.find((i) => i.id === currentId);
        if (parent) {
          ancestors.unshift(parent.name);
          currentId = parent.parentId;
        } else {
          break;
        }
      }

      if (ancestors.length > 0) {
        breadcrumb = ancestors.join(" / ");
      }
    }

    return {
      id: upNextResult.id,
      name: upNextResult.name,
      artworkId: artwork?.driveFileId ?? null,
      breadcrumb,
      fileId: file.id,
      fileName: file.filename,
      position: file.playbackPosition ?? 0,
    };
  } catch (error) {
    logger.error({ error, parentId }, "Failed to get up next item");
    return null;
  }
}

/**
 * Builds tree structure for Up Next DFS traversal.
 */
function buildTreeForUpNext(
  items: {
    id: string;
    name: string;
    parentId: string | null;
    order: number;
    completionStatus: CompletionStatus;
    files: { playbackPosition: number | null; playbackDuration: number | null }[];
  }[]
): Parameters<typeof findUpNextItem>[0] {
  const itemMap = new Map<
    string,
    {
      id: string;
      name: string;
      completionStatus: CompletionStatus;
      children: typeof items;
      files: { playbackPosition: number | null; playbackDuration: number | null }[];
    }
  >();
  const roots: typeof items = [];

  // Create nodes
  for (const item of items) {
    itemMap.set(item.id, {
      id: item.id,
      name: item.name,
      completionStatus: item.completionStatus,
      children: [],
      files: item.files,
    });
  }

  // Build tree
  for (const item of items) {
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    } else {
      roots.push(item);
    }
  }

  // Sort by order
  function sortAndConvert(nodes: typeof items): Parameters<typeof findUpNextItem>[0] {
    return nodes
      .sort((a, b) => a.order - b.order)
      .map((n) => {
        const node = itemMap.get(n.id)!;
        return {
          id: node.id,
          name: node.name,
          completionStatus: node.completionStatus,
          children: sortAndConvert(node.children),
          files: node.files,
        };
      });
  }

  return sortAndConvert(roots);
}
```

Also add the import at the top:

```typescript
import type { CompletionStatus } from "@prisma/client";
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/lib/item-actions-up-next.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions-up-next.test.ts
git commit -m "$(cat <<'EOF'
feat(actions): add getUpNext server action

Finds first incomplete item with media using DFS traversal.
Returns item details for quick navigation to next content.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: NavContinueWatching Component

**Files:**
- Create: `components/nav-continue-watching.tsx`
- Create: `tests/unit/components/nav-continue-watching.test.tsx`

**Step 1: Write failing component tests**

Create `tests/unit/components/nav-continue-watching.test.tsx`:

```typescript
/**
 * Unit tests for NavContinueWatching component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavContinueWatching } from "@/components/nav-continue-watching";
import type { ContinueWatchingItem, UpNextItem } from "@/lib/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/my-items",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("NavContinueWatching", () => {
  const mockContinueItems: ContinueWatchingItem[] = [
    {
      id: "item-1",
      name: "Breaking Bad S01E02",
      description: null,
      artworkId: "art-123",
      breadcrumb: "Breaking Bad / Season 1",
      lastWatchedAt: new Date(),
      progressPercentage: 45,
      currentFileName: "episode.mkv",
      currentPosition: 1620,
      currentDuration: 3600,
    },
    {
      id: "item-2",
      name: "The Matrix",
      description: null,
      artworkId: null,
      breadcrumb: "Movies",
      lastWatchedAt: new Date(),
      progressPercentage: 75,
      currentFileName: "matrix.mkv",
      currentPosition: 5400,
      currentDuration: 7200,
    },
  ];

  const mockUpNext: UpNextItem = {
    id: "item-3",
    name: "Breaking Bad S01E03",
    artworkId: "art-456",
    breadcrumb: "Breaking Bad / Season 1",
    fileId: "file-3",
    fileName: "episode3.mkv",
    position: 0,
  };

  it("renders nothing when no items", () => {
    const { container } = render(
      <NavContinueWatching continueItems={[]} upNext={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Continue Watching section with items", () => {
    render(
      <NavContinueWatching continueItems={mockContinueItems} upNext={null} />
    );

    expect(screen.getByText("Continue Watching")).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad S01E02")).toBeInTheDocument();
    expect(screen.getByText("The Matrix")).toBeInTheDocument();
  });

  it("shows progress bars for each item", () => {
    render(
      <NavContinueWatching continueItems={mockContinueItems} upNext={null} />
    );

    // Progress bars should have width style based on percentage
    const progressBars = document.querySelectorAll('[data-testid="progress-bar"]');
    expect(progressBars).toHaveLength(2);
  });

  it("renders Up Next section when provided", () => {
    render(
      <NavContinueWatching continueItems={[]} upNext={mockUpNext} />
    );

    expect(screen.getByText("Up Next")).toBeInTheDocument();
    expect(screen.getByText("Breaking Bad S01E03")).toBeInTheDocument();
  });

  it("shows breadcrumb path", () => {
    render(
      <NavContinueWatching continueItems={mockContinueItems} upNext={null} />
    );

    expect(screen.getByText("Breaking Bad / Season 1")).toBeInTheDocument();
  });

  it("links to item detail page", () => {
    render(
      <NavContinueWatching continueItems={mockContinueItems} upNext={null} />
    );

    const link = screen.getByRole("link", { name: /Breaking Bad S01E02/i });
    expect(link).toHaveAttribute("href", "/my-items/item-1");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/components/nav-continue-watching.test.tsx`
Expected: FAIL - component not found

**Step 3: Implement NavContinueWatching component**

Create `components/nav-continue-watching.tsx`:

```typescript
/**
 * Continue Watching and Up Next navigation sections for sidebar.
 * Displays items with playback progress and quick navigation to next item.
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Play, FastForward, Folder } from "lucide-react";
import type { ContinueWatchingItem, UpNextItem } from "@/lib/types";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface NavContinueWatchingProps {
  continueItems: ContinueWatchingItem[];
  upNext: UpNextItem | null;
}

/**
 * Formats seconds to human-readable time (e.g., "45:00" or "1:23:45").
 */
function formatTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Renders Continue Watching and Up Next sections in the sidebar.
 *
 * @param continueItems - Items with playback progress
 * @param upNext - Next item to watch (first incomplete)
 */
export function NavContinueWatching({
  continueItems,
  upNext,
}: NavContinueWatchingProps) {
  const pathname = usePathname();

  // Don't render if nothing to show
  if (continueItems.length === 0 && !upNext) {
    return null;
  }

  return (
    <>
      {/* Up Next Section */}
      {upNext && (
        <SidebarGroup>
          <SidebarGroupLabel className="gap-1.5">
            <FastForward className="size-3.5" />
            Up Next
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={upNext.name}
                  isActive={pathname === `/my-items/${upNext.id}`}
                >
                  <Link href={`/my-items/${upNext.id}`}>
                    <Play className="size-4" />
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="truncate">{upNext.name}</span>
                      {upNext.breadcrumb && (
                        <span className="truncate text-[10px] text-muted-foreground">
                          {upNext.breadcrumb}
                        </span>
                      )}
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {/* Continue Watching Section */}
      {continueItems.length > 0 && (
        <SidebarGroup>
          <SidebarGroupLabel>Continue Watching</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {continueItems.map((item) => {
                const href = `/my-items/${item.id}`;
                const isActive =
                  pathname === href || pathname.startsWith(`${href}/`);

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.name}
                      isActive={isActive}
                    >
                      <Link href={href}>
                        <Folder className="size-4 shrink-0" />
                        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                          <span className="truncate">{item.name}</span>
                          {item.breadcrumb && (
                            <span className="truncate text-[10px] text-muted-foreground">
                              {item.breadcrumb}
                            </span>
                          )}
                          {/* Progress bar */}
                          <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
                            <div
                              data-testid="progress-bar"
                              className={cn(
                                "h-full rounded-full transition-all",
                                item.progressPercentage >= 90
                                  ? "bg-green-500"
                                  : "bg-primary"
                              )}
                              style={{ width: `${item.progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {formatTime(item.currentPosition)} /{" "}
                            {formatTime(item.currentDuration)}
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
    </>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/nav-continue-watching.test.tsx`
Expected: All tests pass

**Step 5: Commit**

```bash
git add components/nav-continue-watching.tsx tests/unit/components/nav-continue-watching.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add NavContinueWatching sidebar component

Displays Continue Watching items with progress bars and Up Next
quick navigation in the sidebar.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Integrate into Sidebar

**Files:**
- Modify: `components/app-sidebar.tsx`
- Modify: `app/(my-items)/layout.tsx`

**Step 1: Update AppSidebar props**

Add to `components/app-sidebar.tsx` interface:

```typescript
import { NavContinueWatching } from "@/components/nav-continue-watching";
import type { ContinueWatchingItem, UpNextItem } from "@/lib/types";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  // ... existing props ...
  /** Continue watching items for sidebar */
  continueWatching?: ContinueWatchingItem[];
  /** Up next item for quick navigation */
  upNext?: UpNextItem | null;
}
```

**Step 2: Render NavContinueWatching in sidebar**

Add in `SidebarContent` after the pinned items section:

```typescript
{/* Show continue watching for my-items context */}
{context === "my-items" && (continueWatching || upNext) && (
  <NavContinueWatching
    continueItems={continueWatching ?? []}
    upNext={upNext ?? null}
  />
)}
```

**Step 3: Update layout to fetch continue watching data**

Modify `app/(my-items)/layout.tsx` to add:

```typescript
import { getContinueWatching, getUpNext } from "@/lib/item-actions";

// In the component, add parallel data fetching:
const [continueWatching, upNext] = await Promise.all([
  getContinueWatching(),
  getUpNext(),
]);

// Pass to AppSidebar:
<AppSidebar
  user={sidebarUser}
  context="my-items"
  driveConnection={driveConnection}
  pinnedItems={pinnedItems}
  continueWatching={continueWatching}
  upNext={upNext}
/>
```

**Step 4: Run type check**

Run: `pnpm run type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add components/app-sidebar.tsx app/\(my-items\)/layout.tsx
git commit -m "$(cat <<'EOF'
feat(ui): integrate Continue Watching into sidebar

Fetches and displays continue watching items and up next
in the my-items sidebar layout.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Context Menu Completion Actions

**Files:**
- Modify: `components/items/item-context-menu.tsx`
- Modify: `tests/unit/components/items/item-context-menu.test.tsx`

**Step 1: Add completion status tests**

Add to `tests/unit/components/items/item-context-menu.test.tsx`:

```typescript
describe("completion status actions", () => {
  it("shows Mark Complete for incomplete items", async () => {
    render(
      <ItemContextMenu
        item={{ ...mockItem, completionStatus: "INCOMPLETE" }}
        onDelete={vi.fn()}
      >
        <button>Open</button>
      </ItemContextMenu>
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Mark Complete")).toBeInTheDocument();
    expect(screen.getByText("Skip")).toBeInTheDocument();
    expect(screen.queryByText("Mark Incomplete")).not.toBeInTheDocument();
  });

  it("shows Mark Incomplete for completed items", async () => {
    render(
      <ItemContextMenu
        item={{ ...mockItem, completionStatus: "COMPLETED" }}
        onDelete={vi.fn()}
      >
        <button>Open</button>
      </ItemContextMenu>
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Mark Incomplete")).toBeInTheDocument();
    expect(screen.queryByText("Mark Complete")).not.toBeInTheDocument();
  });

  it("shows Mark Incomplete for skipped items", async () => {
    render(
      <ItemContextMenu
        item={{ ...mockItem, completionStatus: "SKIPPED" }}
        onDelete={vi.fn()}
      >
        <button>Open</button>
      </ItemContextMenu>
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Mark Incomplete")).toBeInTheDocument();
  });

  it("calls markItemComplete on click", async () => {
    const markCompleteMock = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(markItemComplete).mockImplementation(markCompleteMock);

    render(
      <ItemContextMenu
        item={{ ...mockItem, completionStatus: "INCOMPLETE" }}
        onDelete={vi.fn()}
      >
        <button>Open</button>
      </ItemContextMenu>
    );

    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByText("Mark Complete"));

    expect(markCompleteMock).toHaveBeenCalledWith(mockItem.id);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test:unit tests/unit/components/items/item-context-menu.test.tsx -t "completion status"`
Expected: FAIL - completion actions not rendered

**Step 3: Update ItemContextMenu with completion actions**

Modify `components/items/item-context-menu.tsx`:

Add imports:
```typescript
import { Check, SkipForward, RotateCcw } from "lucide-react";
import type { CompletionStatus } from "@/lib/types";
import {
  markItemComplete,
  markItemSkipped,
  markItemIncomplete,
} from "@/lib/item-actions";
```

Update the interface to include completionStatus:
```typescript
interface ItemContextMenuProps {
  // ... existing props
  item: {
    id: string;
    name: string;
    completionStatus?: CompletionStatus;
    // ... other fields
  };
}
```

Add handlers:
```typescript
async function handleMarkComplete() {
  const result = await markItemComplete(item.id);
  if (result.success) {
    toast.success("Marked as complete");
    router.refresh();
  } else {
    toast.error(result.error || "Failed to mark complete");
  }
}

async function handleMarkSkipped() {
  const result = await markItemSkipped(item.id);
  if (result.success) {
    toast.success("Marked as skipped");
    router.refresh();
  } else {
    toast.error(result.error || "Failed to mark skipped");
  }
}

async function handleMarkIncomplete() {
  const result = await markItemIncomplete(item.id);
  if (result.success) {
    toast.success("Marked as incomplete");
    router.refresh();
  } else {
    toast.error(result.error || "Failed to mark incomplete");
  }
}
```

Add menu items after Settings:
```typescript
<ContextMenuSeparator />
{item.completionStatus === "INCOMPLETE" ? (
  <>
    <ContextMenuItem onClick={handleMarkComplete} className="gap-2">
      <Check className="size-4" strokeWidth={2} />
      <span>Mark Complete</span>
    </ContextMenuItem>
    <ContextMenuItem onClick={handleMarkSkipped} className="gap-2">
      <SkipForward className="size-4" strokeWidth={2} />
      <span>Skip</span>
    </ContextMenuItem>
  </>
) : (
  <ContextMenuItem onClick={handleMarkIncomplete} className="gap-2">
    <RotateCcw className="size-4" strokeWidth={2} />
    <span>Mark Incomplete</span>
  </ContextMenuItem>
)}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test:unit tests/unit/components/items/item-context-menu.test.tsx`
Expected: All tests pass

**Step 5: Commit**

```bash
git add components/items/item-context-menu.tsx tests/unit/components/items/item-context-menu.test.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add completion status actions to context menu

Adds Mark Complete, Skip, and Mark Incomplete options to the
item context menu based on current completion status.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Progress Badge in Grid/Tree

**Files:**
- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `components/sortable-tree/components/TreeItem/TreeItem.tsx`
- Modify: `tests/unit/components/sortable-grid.test.tsx`

**Step 1: Add progress badge to GridItem**

Modify `components/sortable-grid/GridItem.tsx`:

Add imports:
```typescript
import { Check, SkipForward } from "lucide-react";
import type { CompletionStatus } from "@/lib/types";
```

Add to props interface:
```typescript
completionStatus?: CompletionStatus;
progressPercentage?: number;
```

Add progress indicator in the card (after the title section):
```typescript
{/* Completion badge */}
{completionStatus === "COMPLETED" && (
  <div className="absolute top-2 right-2 rounded-full bg-green-500 p-1">
    <Check className="size-3 text-white" />
  </div>
)}
{completionStatus === "SKIPPED" && (
  <div className="absolute top-2 right-2 rounded-full bg-muted p-1">
    <SkipForward className="size-3 text-muted-foreground" />
  </div>
)}

{/* Progress bar for incomplete items */}
{completionStatus === "INCOMPLETE" && progressPercentage !== undefined && progressPercentage > 0 && (
  <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/50">
    <div
      className="h-full bg-primary transition-all"
      style={{ width: `${progressPercentage}%` }}
    />
  </div>
)}
```

**Step 2: Add completion badges to TreeItem similarly**

Follow the same pattern for `TreeItem.tsx`.

**Step 3: Update tests**

Add to `tests/unit/components/sortable-grid.test.tsx`:

```typescript
it("shows completion badge for completed items", () => {
  render(
    <GridItem
      item={{ ...mockItem, completionStatus: "COMPLETED" }}
    />
  );

  expect(screen.getByTestId("completion-badge-check")).toBeInTheDocument();
});

it("shows progress bar for in-progress items", () => {
  render(
    <GridItem
      item={{ ...mockItem, completionStatus: "INCOMPLETE", progressPercentage: 45 }}
    />
  );

  const progressBar = screen.getByTestId("progress-bar");
  expect(progressBar).toHaveStyle({ width: "45%" });
});
```

**Step 4: Run tests**

Run: `pnpm run test:unit tests/unit/components/sortable-grid.test.tsx`
Expected: All tests pass

**Step 5: Commit**

```bash
git add components/sortable-grid/ components/sortable-tree/ tests/unit/components/
git commit -m "$(cat <<'EOF'
feat(ui): add progress badges to grid and tree views

Shows completion checkmark, skip icon, or progress bar on items
based on their completion status.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Integration Tests

**Files:**
- Create: `tests/integration/items/item-completion.test.ts`

**Step 1: Write integration tests**

Create `tests/integration/items/item-completion.test.ts`:

```typescript
/**
 * Integration tests for item completion status.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  markItemComplete,
  markItemSkipped,
  markItemIncomplete,
  getContinueWatching,
  getUpNext,
} from "@/lib/item-actions";
import { updatePlaybackPosition } from "@/lib/item-file-actions";

// Mock auth to return test user
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "test-user-integration" } }),
}));

describe("item completion integration", () => {
  let testUserId: string;
  let testItemId: string;
  let testFileId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        id: "test-user-integration",
        email: "completion-test@example.com",
        passwordHash: "hash",
      },
    });
    testUserId = user.id;

    // Create test item with media file
    const item = await prisma.item.create({
      data: {
        name: "Test Movie",
        userId: testUserId,
        order: 0,
        depth: 0,
        files: {
          create: {
            filename: "movie.mkv",
            fileType: "MEDIA",
            mimeType: "video/x-matroska",
            playbackDuration: 7200,
          },
        },
      },
      include: { files: true },
    });
    testItemId = item.id;
    testFileId = item.files[0].id;
  });

  afterEach(async () => {
    await prisma.itemFile.deleteMany({
      where: { item: { userId: testUserId } },
    });
    await prisma.item.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("marks item as complete and updates timestamp", async () => {
    const result = await markItemComplete(testItemId);
    expect(result.success).toBe(true);

    const item = await prisma.item.findUnique({
      where: { id: testItemId },
    });
    expect(item?.completionStatus).toBe("COMPLETED");
    expect(item?.completedAt).not.toBeNull();
  });

  it("marks item as skipped", async () => {
    const result = await markItemSkipped(testItemId);
    expect(result.success).toBe(true);

    const item = await prisma.item.findUnique({
      where: { id: testItemId },
    });
    expect(item?.completionStatus).toBe("SKIPPED");
    expect(item?.completedAt).toBeNull();
  });

  it("resets item to incomplete", async () => {
    await markItemComplete(testItemId);
    const result = await markItemIncomplete(testItemId);
    expect(result.success).toBe(true);

    const item = await prisma.item.findUnique({
      where: { id: testItemId },
    });
    expect(item?.completionStatus).toBe("INCOMPLETE");
    expect(item?.completedAt).toBeNull();
  });

  it("updates lastWatchedAt on playback position change", async () => {
    await updatePlaybackPosition(testFileId, 1800, 7200);

    const item = await prisma.item.findUnique({
      where: { id: testItemId },
    });
    expect(item?.lastWatchedAt).not.toBeNull();
  });

  it("getContinueWatching returns items with progress", async () => {
    // Set playback position
    await updatePlaybackPosition(testFileId, 1800, 7200);

    const items = await getContinueWatching();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].id).toBe(testItemId);
    expect(items[0].progressPercentage).toBe(25);
  });

  it("getUpNext returns first incomplete item", async () => {
    const upNext = await getUpNext();
    expect(upNext).not.toBeNull();
    expect(upNext?.id).toBe(testItemId);
  });

  it("getUpNext skips completed items", async () => {
    await markItemComplete(testItemId);

    const upNext = await getUpNext();
    expect(upNext).toBeNull();
  });
});
```

**Step 2: Run integration tests**

Run: `pnpm run test:integration tests/integration/items/item-completion.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add tests/integration/items/item-completion.test.ts
git commit -m "$(cat <<'EOF'
test(integration): add item completion integration tests

Tests completion status changes, lastWatchedAt updates,
getContinueWatching, and getUpNext with real database.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: E2E Tests

**Files:**
- Create: `e2e/journeys/items/continue-watching.spec.ts`

**Step 1: Write E2E tests**

Create `e2e/journeys/items/continue-watching.spec.ts`:

```typescript
/**
 * E2E tests for Continue Watching and Progress features.
 */

import { test, expect } from "@playwright/test";
import { ItemsPage } from "@/e2e/pages/items.page";

test.describe("Continue Watching", () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to my-items
    await page.goto("/sign-in");
    // ... authentication steps
  });

  test("shows continue watching in sidebar after watching video", async ({
    page,
  }) => {
    const itemsPage = new ItemsPage(page);

    // Navigate to an item with video
    await itemsPage.navigateToItem("Test Movie");

    // Play video and watch for a bit
    await itemsPage.playMedia();
    await page.waitForTimeout(5000); // Wait for position to save

    // Close video and check sidebar
    await page.keyboard.press("Escape");

    // Continue Watching section should appear
    await expect(
      page.getByRole("heading", { name: "Continue Watching" })
    ).toBeVisible();
    await expect(page.getByText("Test Movie")).toBeVisible();
  });

  test("shows progress bar on item card", async ({ page }) => {
    // After watching video, grid view should show progress
    await expect(page.getByTestId("progress-bar")).toBeVisible();
  });

  test("mark complete via context menu", async ({ page }) => {
    const itemsPage = new ItemsPage(page);

    // Right-click item
    await itemsPage.openContextMenu("Test Movie");
    await page.getByText("Mark Complete").click();

    // Should show completion badge
    await expect(page.getByTestId("completion-badge-check")).toBeVisible();

    // Should be removed from Continue Watching
    await expect(page.getByText("Test Movie")).not.toBeVisible();
  });

  test("up next navigates to first incomplete item", async ({ page }) => {
    // Click Up Next in sidebar
    await page.getByRole("link", { name: /Up Next/i }).click();

    // Should navigate to the item
    await expect(page).toHaveURL(/\/my-items\/.+/);
  });
});
```

**Step 2: Run E2E tests**

Run: `pnpm run test:e2e e2e/journeys/items/continue-watching.spec.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add e2e/journeys/items/continue-watching.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add Continue Watching E2E tests

Tests sidebar display, progress bars, completion marking,
and Up Next navigation end-to-end.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Final Verification and Documentation

**Step 1: Run all checks**

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

**Step 2: Run all tests**

Run: `pnpm run test && pnpm run test:integration && pnpm run test:e2e`
Expected: All tests pass

**Step 3: Update todo.md**

Add to `docs/todo.md` in completed features:

```markdown
## Completed Features

### v2.9.0 - Continue Watching & Progress
- [x] Item completion status (INCOMPLETE, COMPLETED, SKIPPED)
- [x] lastWatchedAt tracking for recent activity
- [x] Progress calculation utilities
- [x] getContinueWatching server action
- [x] getUpNext server action (DFS traversal)
- [x] NavContinueWatching sidebar component
- [x] Context menu completion actions
- [x] Progress badges in grid/tree views
```

**Step 4: Commit documentation**

```bash
git add docs/todo.md
git commit -m "$(cat <<'EOF'
docs: add Continue Watching feature to todo.md

Documents v2.9.0 Continue Watching & Progress feature completion.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Test Summary

### Unit Tests to Add/Modify
- `tests/unit/lib/progress-utils.test.ts` (new) - Progress calculation utilities
- `tests/unit/lib/item-actions-completion.test.ts` (new) - Completion status actions
- `tests/unit/lib/item-actions-continue-watching.test.ts` (new) - getContinueWatching
- `tests/unit/lib/item-actions-up-next.test.ts` (new) - getUpNext
- `tests/unit/lib/item-file-actions.test.ts` (modify) - lastWatchedAt update
- `tests/unit/components/nav-continue-watching.test.tsx` (new) - Sidebar component
- `tests/unit/components/items/item-context-menu.test.tsx` (modify) - Completion actions
- `tests/unit/components/sortable-grid.test.tsx` (modify) - Progress badges

### Integration Tests to Add
- `tests/integration/items/item-completion.test.ts` (new) - Full completion flow

### E2E Tests to Add
- `e2e/journeys/items/continue-watching.spec.ts` (new) - End-to-end progress features

### Existing Tests to Review
- `tests/unit/lib/item-actions.test.ts` - May need mock updates for new fields
- `tests/unit/components/items/items-view.test.tsx` - May need completion status props
- `e2e/journeys/items/items-crud.spec.ts` - May need updates for new fields

---

## Summary

This plan implements a Trakt-inspired Continue Watching and Progress feature:

1. **Database**: Adds `CompletionStatus` enum (INCOMPLETE, COMPLETED, SKIPPED) and tracking fields (`completedAt`, `lastWatchedAt`)

2. **Utilities**: Progress calculation (`calculateFileProgress`, `isFileComplete`, `calculateItemProgress`) and Up Next DFS traversal (`findUpNextItem`)

3. **Server Actions**: `markItemComplete`, `markItemSkipped`, `markItemIncomplete`, `getContinueWatching`, `getUpNext`

4. **UI Components**: `NavContinueWatching` sidebar section with progress bars, completion badges in grid/tree views, context menu completion actions

5. **Testing**: Comprehensive unit, integration, and E2E test coverage

The feature surfaces the existing playback position tracking in a user-friendly way, helping users track progress across their library and quickly find their next item to watch.

Sources:
- [Trakt Continue Watching Feature Spotlight](https://forums.trakt.tv/t/new-trakt-feature-spotlight-continue-watching-start-watching/89875)
- [Trakt Lite Design Announcement](https://alternativeto.net/news/2025/12/trakt-rolls-out-continue-watching-and-start-watching-smart-lists-in-new-lite-design/)
