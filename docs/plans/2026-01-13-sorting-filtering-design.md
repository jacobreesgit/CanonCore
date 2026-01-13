# Sorting, Filtering & Preferences Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add sorting and filtering controls to my-items and item detail pages, with user preferences persisted to the database via a new "Preferences" tab in Settings.

**Architecture:** Client-side sorting/filtering applied to already-fetched items. Preferences stored in database (syncs across devices) with localStorage as cache. When non-default sort is active, drag-drop reordering is disabled. Dropdown controls added to toolbar.

**Tech Stack:** React state, Prisma User model, server actions, shadcn Tabs + DropdownMenu, existing Settings dialog

---

## Design Decisions

### Sort Options

| Option           | Field       | Direction                   |
| ---------------- | ----------- | --------------------------- |
| Custom (default) | `order`     | Ascending (user drag order) |
| Name A-Z         | `name`      | Ascending                   |
| Name Z-A         | `name`      | Descending                  |
| Newest First     | `createdAt` | Descending                  |
| Oldest First     | `createdAt` | Ascending                   |
| Recently Updated | `updatedAt` | Descending                  |

### Filter Options

| Option        | Logic                                                                |
| ------------- | -------------------------------------------------------------------- |
| All (default) | No filter                                                            |
| Has Files     | `fileCounts.media + fileCounts.artwork + fileCounts.subtitles > 0`   |
| No Files      | `fileCounts.media + fileCounts.artwork + fileCounts.subtitles === 0` |
| Synced        | `syncStatus === "SYNCED"`                                            |
| Pending Sync  | `syncStatus === "PENDING"`                                           |
| Sync Error    | `syncStatus === "ERROR"`                                             |

### View Mode Options

| Option         | Description                    |
| -------------- | ------------------------------ |
| Grid (default) | Movie poster card layout       |
| Tree           | Hierarchical list with nesting |

### Preferences Storage Strategy

1. **Database** (source of truth): User model stores `defaultViewMode`, `defaultSortBy`
2. **localStorage** (cache): Fast hydration, syncs with DB on save
3. **Session state**: Allows temporary overrides without persisting

> **Design Note - String? vs Enum Trade-off:**
> The schema uses `String?` instead of Prisma enums for preference fields. This allows adding new sort/filter options without database migrations. Trade-off: Less compile-time type safety, but more deployment flexibility. Runtime validation ensures only valid values are accepted.

### Key Behaviors

1. **Sort vs Drag**: When sort is not "Custom", drag-drop is disabled with visual indicator
2. **Persistence**: Preferences saved to database via Settings dialog, cached in localStorage
3. **Scope**: Sorting/filtering applies to current level only (children of current parent)
4. **Tree View**: In tree view, sorting applies to root-level items; children keep their order
5. **Cross-device sync**: Preferences load from DB on login, localStorage is cache

---

## Components to Create/Modify

| Component                                | Action | Purpose                                       |
| ---------------------------------------- | ------ | --------------------------------------------- |
| `prisma/schema.prisma`                   | Modify | Add preference fields to User model           |
| `lib/types.ts`                           | Modify | Add ViewMode, SortOption, FilterOption types  |
| `lib/user-actions.ts`                    | Modify | Add getPreferences, updatePreferences actions |
| `hooks/use-items-sort-filter.ts`         | Create | State management hook (localStorage cache)    |
| `components/items/sort-dropdown.tsx`     | Create | Sort option dropdown                          |
| `components/items/filter-dropdown.tsx`   | Create | Filter option dropdown                        |
| `components/items/items-toolbar.tsx`     | Modify | Add sort/filter dropdowns                     |
| `components/items/items-view.tsx`        | Modify | Apply sort/filter to items                    |
| `components/items/view-toggle.tsx`       | Modify | Import ViewMode from lib/types.ts             |
| `components/profile/settings-dialog.tsx` | Modify | Add tabbed layout with Preferences tab        |
| `components/profile/preferences-tab.tsx` | Create | Preferences configuration UI                  |
| `lib/item-utils.ts`                      | Modify | Add sorting/filtering utility functions       |

---

## Task 1: Add Preference Fields to User Model

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDD_add_user_preferences/migration.sql`

### Step 1: Update schema

```prisma
// Add to User model in prisma/schema.prisma

model User {
  // ... existing fields ...

  // User preferences (nullable = use defaults)
  // Note: Using String? instead of enums for flexibility - allows adding new options without migrations
  defaultViewMode   String?   // "grid" | "tree"
  defaultSortBy     String?   // "custom" | "name-asc" | "name-desc" | "created-desc" | "created-asc" | "updated-desc"

  // ... rest of model ...
}
```

### Step 2: Create and run migration

Run: `npx prisma migrate dev --name add_user_preferences`
Expected: Migration creates nullable columns with no default (null = use app defaults)

---

## Task 2: Add Types to lib/types.ts

**Files:**

- Modify: `lib/types.ts`

### Step 1: Add preference types

Add to `lib/types.ts` (centralizes types for better organization):

```typescript
// Add to lib/types.ts

/** View mode for items display. */
export type ViewMode = "grid" | "tree";

/** Sort option for items list. */
export type SortOption =
  | "custom"
  | "name-asc"
  | "name-desc"
  | "created-desc"
  | "created-asc"
  | "updated-desc";

/** Filter option for items list. */
export type FilterOption =
  | "all"
  | "has-files"
  | "no-files"
  | "synced"
  | "pending"
  | "error";

/** Valid view modes for validation. */
export const VALID_VIEW_MODES: ViewMode[] = ["grid", "tree"];

/** Valid sort options for validation. */
export const VALID_SORT_OPTIONS: SortOption[] = [
  "custom",
  "name-asc",
  "name-desc",
  "created-desc",
  "created-asc",
  "updated-desc",
];

/** Valid filter options for validation. */
export const VALID_FILTER_OPTIONS: FilterOption[] = [
  "all",
  "has-files",
  "no-files",
  "synced",
  "pending",
  "error",
];

/** Type guard for validating sort options. */
export function isValidSortOption(value: string): value is SortOption {
  return VALID_SORT_OPTIONS.includes(value as SortOption);
}

/** Type guard for validating filter options. */
export function isValidFilterOption(value: string): value is FilterOption {
  return VALID_FILTER_OPTIONS.includes(value as FilterOption);
}

/** Type guard for validating view modes. */
export function isValidViewMode(value: string): value is ViewMode {
  return VALID_VIEW_MODES.includes(value as ViewMode);
}
```

---

## Task 3: Create Preferences Server Actions

**Files:**

- Modify: `lib/user-actions.ts`
- Create: `tests/unit/lib/user-actions-preferences.test.ts`

### Step 1: Write failing tests

```typescript
// tests/unit/lib/user-actions-preferences.test.ts
/**
 * Unit tests for user preferences server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPreferences, updatePreferences } from "@/lib/user-actions";

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

describe("getPreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default preferences when user has none set", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      defaultViewMode: null,
      defaultSortBy: null,
    } as any);

    const result = await getPreferences();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      viewMode: "grid",
      sortBy: "custom",
    });
  });

  it("returns stored preferences", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      defaultViewMode: "tree",
      defaultSortBy: "name-asc",
    } as any);

    const result = await getPreferences();

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      viewMode: "tree",
      sortBy: "name-asc",
    });
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await getPreferences();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Not authenticated");
  });
});

describe("updatePreferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates view mode preference", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const result = await updatePreferences({ viewMode: "tree" });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { defaultViewMode: "tree" },
    });
  });

  it("updates sort preference", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const result = await updatePreferences({ sortBy: "name-asc" });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { defaultSortBy: "name-asc" },
    });
  });

  it("updates multiple preferences at once", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    const result = await updatePreferences({
      viewMode: "tree",
      sortBy: "created-desc",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        defaultViewMode: "tree",
        defaultSortBy: "created-desc",
      },
    });
  });

  it("validates view mode value", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const result = await updatePreferences({ viewMode: "invalid" as any });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid view mode");
  });

  it("validates sort value", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const result = await updatePreferences({ sortBy: "invalid" as any });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid sort option");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/lib/user-actions-preferences.test.ts`
Expected: FAIL - functions not exported

### Step 3: Implement server actions

Add to `lib/user-actions.ts`:

```typescript
// Add imports
import type { ViewMode, SortOption } from "@/lib/types";
import {
  VALID_VIEW_MODES,
  VALID_SORT_OPTIONS,
  isValidViewMode,
  isValidSortOption,
} from "@/lib/types";

/** User preferences data. */
export interface UserPreferences {
  viewMode: ViewMode;
  sortBy: SortOption;
}

/**
 * Get current user's preferences.
 * Returns defaults if no preferences are set.
 *
 * @returns User preferences or error
 *
 * @example
 * const result = await getPreferences();
 * if (result.success) {
 *   console.log(result.data.viewMode); // "grid" | "tree"
 *   console.log(result.data.sortBy);   // "custom" | "name-asc" | ...
 * }
 */
export async function getPreferences(): Promise<ActionResult<UserPreferences>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        defaultViewMode: true,
        defaultSortBy: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Validate stored values, fall back to defaults if invalid
    const viewMode =
      user.defaultViewMode && isValidViewMode(user.defaultViewMode)
        ? user.defaultViewMode
        : "grid";
    const sortBy =
      user.defaultSortBy && isValidSortOption(user.defaultSortBy)
        ? user.defaultSortBy
        : "custom";

    return {
      success: true,
      data: { viewMode, sortBy },
    };
  } catch (error) {
    logger.error({ err: error }, "Get preferences error");
    return { success: false, error: "Failed to get preferences" };
  }
}

/**
 * Update user preferences.
 * Only updates provided fields.
 *
 * @param data - Preferences to update
 * @returns Success or error result
 *
 * @example
 * // Update view mode only
 * await updatePreferences({ viewMode: "tree" });
 *
 * @example
 * // Update multiple preferences
 * await updatePreferences({ viewMode: "grid", sortBy: "name-asc" });
 */
export async function updatePreferences(data: {
  viewMode?: ViewMode;
  sortBy?: SortOption;
}): Promise<ActionResult<void>> {
  const userId = await getAuthUserId();
  if (!userId) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate inputs
  if (
    data.viewMode !== undefined &&
    !VALID_VIEW_MODES.includes(data.viewMode)
  ) {
    return { success: false, error: "Invalid view mode" };
  }

  if (data.sortBy !== undefined && !VALID_SORT_OPTIONS.includes(data.sortBy)) {
    return { success: false, error: "Invalid sort option" };
  }

  try {
    const updateData: Record<string, string> = {};

    if (data.viewMode !== undefined) {
      updateData.defaultViewMode = data.viewMode;
    }
    if (data.sortBy !== undefined) {
      updateData.defaultSortBy = data.sortBy;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return { success: true };
  } catch (error) {
    logger.error({ err: error }, "Update preferences error");
    return { success: false, error: "Failed to update preferences" };
  }
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/lib/user-actions-preferences.test.ts`
Expected: PASS

---

## Task 4: Create Sort/Filter Utility Functions

**Files:**

- Modify: `lib/item-utils.ts`
- Create: `tests/unit/lib/item-utils-sort-filter.test.ts`

### Step 1: Write failing tests

```typescript
// tests/unit/lib/item-utils-sort-filter.test.ts
/**
 * Unit tests for item sorting and filtering utilities.
 */

import { describe, it, expect } from "vitest";
import {
  sortItems,
  filterItems,
  SORT_OPTIONS,
  FILTER_OPTIONS,
} from "@/lib/item-utils";
import type { SortOption, FilterOption } from "@/lib/types";
import type { ItemWithArtwork } from "@/lib/types";

const mockItems: ItemWithArtwork[] = [
  {
    id: "1",
    name: "Zebra",
    order: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-10"),
    syncStatus: "SYNCED",
    fileCounts: { media: 1, artwork: 0, subtitles: 0 },
  } as ItemWithArtwork,
  {
    id: "2",
    name: "Apple",
    order: 1,
    createdAt: new Date("2026-01-05"),
    updatedAt: new Date("2026-01-05"),
    syncStatus: "PENDING",
    fileCounts: { media: 0, artwork: 0, subtitles: 0 },
  } as ItemWithArtwork,
  {
    id: "3",
    name: "Mango",
    order: 2,
    createdAt: new Date("2026-01-03"),
    updatedAt: new Date("2026-01-15"),
    syncStatus: "ERROR",
    fileCounts: { media: 2, artwork: 1, subtitles: 0 },
  } as ItemWithArtwork,
  {
    id: "4",
    name: "Banana",
    order: 3,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
    syncStatus: null, // No sync status
    fileCounts: { media: 0, artwork: 1, subtitles: 0 },
  } as ItemWithArtwork,
];

describe("sortItems", () => {
  it("returns items in original order for 'custom' sort", () => {
    const result = sortItems(mockItems, "custom");
    expect(result.map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("sorts by name A-Z", () => {
    const result = sortItems(mockItems, "name-asc");
    expect(result.map((i) => i.name)).toEqual([
      "Apple",
      "Banana",
      "Mango",
      "Zebra",
    ]);
  });

  it("sorts by name Z-A", () => {
    const result = sortItems(mockItems, "name-desc");
    expect(result.map((i) => i.name)).toEqual([
      "Zebra",
      "Mango",
      "Banana",
      "Apple",
    ]);
  });

  it("sorts by newest first", () => {
    const result = sortItems(mockItems, "created-desc");
    expect(result.map((i) => i.id)).toEqual(["2", "3", "4", "1"]);
  });

  it("sorts by oldest first", () => {
    const result = sortItems(mockItems, "created-asc");
    expect(result.map((i) => i.id)).toEqual(["1", "4", "3", "2"]);
  });

  it("sorts by recently updated", () => {
    const result = sortItems(mockItems, "updated-desc");
    expect(result.map((i) => i.id)).toEqual(["3", "1", "2", "4"]);
  });

  it("handles empty array", () => {
    const result = sortItems([], "name-asc");
    expect(result).toEqual([]);
  });

  it("does not mutate original array", () => {
    const original = [...mockItems];
    sortItems(mockItems, "name-asc");
    expect(mockItems).toEqual(original);
  });

  it("provides stable sort for items with same values", () => {
    const sameNameItems = [
      {
        id: "1",
        name: "Alpha",
        order: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "2",
        name: "Alpha",
        order: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "3",
        name: "Alpha",
        order: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const result = sortItems(sameNameItems as any, "name-asc");
    // Should maintain relative order for equal elements
    expect(result.map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
});

describe("filterItems", () => {
  it("returns all items for 'all' filter", () => {
    const result = filterItems(mockItems, "all");
    expect(result.length).toBe(4);
  });

  it("filters to items with files", () => {
    const result = filterItems(mockItems, "has-files");
    expect(result.map((i) => i.id)).toEqual(["1", "3", "4"]);
  });

  it("filters to items without files", () => {
    const result = filterItems(mockItems, "no-files");
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("filters to synced items", () => {
    const result = filterItems(mockItems, "synced");
    expect(result.map((i) => i.id)).toEqual(["1"]);
  });

  it("filters to pending items", () => {
    const result = filterItems(mockItems, "pending");
    expect(result.map((i) => i.id)).toEqual(["2"]);
  });

  it("filters to error items", () => {
    const result = filterItems(mockItems, "error");
    expect(result.map((i) => i.id)).toEqual(["3"]);
  });

  it("handles items with null syncStatus for sync filters", () => {
    const result = filterItems(mockItems, "synced");
    // Item with null syncStatus should not match any sync filter
    expect(result.map((i) => i.id)).not.toContain("4");
  });

  it("handles empty array", () => {
    const result = filterItems([], "has-files");
    expect(result).toEqual([]);
  });

  it("does not mutate original array", () => {
    const original = [...mockItems];
    filterItems(mockItems, "has-files");
    expect(mockItems).toEqual(original);
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/lib/item-utils-sort-filter.test.ts`
Expected: FAIL - functions not exported

### Step 3: Implement sorting/filtering utilities

Add to `lib/item-utils.ts`:

```typescript
// Import types from centralized location
import type { SortOption, FilterOption } from "@/lib/types";
import type { ItemWithArtwork } from "@/lib/types";

// Re-export types for convenience
export type { SortOption, FilterOption };

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "custom", label: "Custom Order" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
  { value: "created-desc", label: "Newest First" },
  { value: "created-asc", label: "Oldest First" },
  { value: "updated-desc", label: "Recently Updated" },
];

export const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "all", label: "All Items" },
  { value: "has-files", label: "Has Files" },
  { value: "no-files", label: "No Files" },
  { value: "synced", label: "Synced" },
  { value: "pending", label: "Pending Sync" },
  { value: "error", label: "Sync Error" },
];

/**
 * Sorts items by the specified sort option.
 * Returns a new array without mutating the original.
 *
 * @param items - Array of items to sort
 * @param sortBy - Sort option to apply
 * @returns Sorted array of items
 *
 * @example
 * const sorted = sortItems(items, "name-asc");
 * // Returns items sorted alphabetically by name
 *
 * @example
 * const sorted = sortItems(items, "created-desc");
 * // Returns items sorted by creation date, newest first
 */
export function sortItems(
  items: ItemWithArtwork[],
  sortBy: SortOption
): ItemWithArtwork[] {
  if (items.length === 0) return [];

  const sorted = [...items];

  switch (sortBy) {
    case "custom":
      return sorted.sort((a, b) => a.order - b.order);
    case "name-asc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
    case "created-desc":
      return sorted.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    case "created-asc":
      return sorted.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
    case "updated-desc":
      return sorted.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    default:
      return sorted;
  }
}

/**
 * Filters items by the specified filter option.
 * Returns a new array without mutating the original.
 *
 * @param items - Array of items to filter
 * @param filterBy - Filter option to apply
 * @returns Filtered array of items
 *
 * @example
 * const withFiles = filterItems(items, "has-files");
 * // Returns only items that have at least one file attached
 *
 * @example
 * const synced = filterItems(items, "synced");
 * // Returns only items with SYNCED status
 */
export function filterItems(
  items: ItemWithArtwork[],
  filterBy: FilterOption
): ItemWithArtwork[] {
  if (items.length === 0) return [];

  switch (filterBy) {
    case "all":
      return [...items];
    case "has-files":
      return items.filter(
        (item) =>
          item.fileCounts.media +
            item.fileCounts.artwork +
            item.fileCounts.subtitles >
          0
      );
    case "no-files":
      return items.filter(
        (item) =>
          item.fileCounts.media +
            item.fileCounts.artwork +
            item.fileCounts.subtitles ===
          0
      );
    case "synced":
      return items.filter((item) => item.syncStatus === "SYNCED");
    case "pending":
      return items.filter((item) => item.syncStatus === "PENDING");
    case "error":
      return items.filter((item) => item.syncStatus === "ERROR");
    default:
      return [...items];
  }
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/lib/item-utils-sort-filter.test.ts`
Expected: PASS

---

## Task 5: Create Sort/Filter State Hook

**Files:**

- Create: `hooks/use-items-sort-filter.ts`
- Create: `tests/unit/hooks/use-items-sort-filter.test.ts`

### Step 1: Write failing tests

```typescript
// tests/unit/hooks/use-items-sort-filter.test.ts
/**
 * Unit tests for useItemsSortFilter hook.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useItemsSortFilter } from "@/hooks/use-items-sort-filter";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("useItemsSortFilter", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("returns default sort and filter values on initial render", async () => {
    const { result } = renderHook(() => useItemsSortFilter());

    // Initial render should use defaults
    expect(result.current.sortBy).toBe("custom");
    expect(result.current.filterBy).toBe("all");
  });

  it("updates sort option and persists to localStorage", async () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setSortBy("name-asc");
    });

    expect(result.current.sortBy).toBe("name-asc");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "canoncore-items-sort",
      "name-asc"
    );
  });

  it("updates filter option and persists to localStorage", async () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setFilterBy("has-files");
    });

    expect(result.current.filterBy).toBe("has-files");
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "canoncore-items-filter",
      "has-files"
    );
  });

  it("loads persisted values from localStorage after mount", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "canoncore-items-sort") return "name-desc";
      if (key === "canoncore-items-filter") return "synced";
      return null;
    });

    const { result } = renderHook(() => useItemsSortFilter());

    // Wait for useEffect to sync from localStorage
    await waitFor(() => {
      expect(result.current.sortBy).toBe("name-desc");
      expect(result.current.filterBy).toBe("synced");
    });
  });

  it("ignores invalid localStorage values and uses defaults", async () => {
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === "canoncore-items-sort") return "invalid-sort";
      if (key === "canoncore-items-filter") return "invalid-filter";
      return null;
    });

    const { result } = renderHook(() => useItemsSortFilter());

    // Should use defaults for invalid values
    await waitFor(() => {
      expect(result.current.sortBy).toBe("custom");
      expect(result.current.filterBy).toBe("all");
    });
  });

  it("returns isCustomSort helper", async () => {
    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.isCustomSort).toBe(true);

    act(() => {
      result.current.setSortBy("name-asc");
    });

    expect(result.current.isCustomSort).toBe(false);
  });

  it("returns hasActiveFilter helper", async () => {
    const { result } = renderHook(() => useItemsSortFilter());

    expect(result.current.hasActiveFilter).toBe(false);

    act(() => {
      result.current.setFilterBy("has-files");
    });

    expect(result.current.hasActiveFilter).toBe(true);
  });

  it("provides reset function", async () => {
    const { result } = renderHook(() => useItemsSortFilter());

    act(() => {
      result.current.setSortBy("name-asc");
      result.current.setFilterBy("has-files");
    });

    expect(result.current.sortBy).toBe("name-asc");
    expect(result.current.filterBy).toBe("has-files");

    act(() => {
      result.current.reset();
    });

    expect(result.current.sortBy).toBe("custom");
    expect(result.current.filterBy).toBe("all");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/hooks/use-items-sort-filter.test.ts`
Expected: FAIL - hook not found

### Step 3: Implement the hook

```typescript
// hooks/use-items-sort-filter.ts
/**
 * Hook for managing items sort and filter state with localStorage persistence.
 * Uses SSR-safe initialization to avoid hydration mismatches.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { SortOption, FilterOption } from "@/lib/types";
import { isValidSortOption, isValidFilterOption } from "@/lib/types";

// Use namespaced keys to avoid conflicts with other apps
const SORT_STORAGE_KEY = "canoncore-items-sort";
const FILTER_STORAGE_KEY = "canoncore-items-filter";

const DEFAULT_SORT: SortOption = "custom";
const DEFAULT_FILTER: FilterOption = "all";

interface UseItemsSortFilterReturn {
  sortBy: SortOption;
  filterBy: FilterOption;
  setSortBy: (sort: SortOption) => void;
  setFilterBy: (filter: FilterOption) => void;
  isCustomSort: boolean;
  hasActiveFilter: boolean;
  reset: () => void;
}

/**
 * Manages sort and filter state for items with localStorage persistence.
 * SSR-safe: initializes with defaults, then syncs from localStorage after mount.
 *
 * @returns Sort/filter state and setters
 *
 * @example
 * const { sortBy, filterBy, setSortBy, setFilterBy, isCustomSort } = useItemsSortFilter();
 *
 * // Check if drag-drop should be disabled
 * const canReorder = isCustomSort;
 *
 * // Apply sort and filter to items
 * const displayItems = filterItems(sortItems(items, sortBy), filterBy);
 */
export function useItemsSortFilter(): UseItemsSortFilterReturn {
  // Initialize with defaults for SSR safety (avoids hydration mismatch)
  const [sortBy, setSortByState] = useState<SortOption>(DEFAULT_SORT);
  const [filterBy, setFilterByState] = useState<FilterOption>(DEFAULT_FILTER);

  // Sync from localStorage after mount (client-side only)
  useEffect(() => {
    const storedSort = localStorage.getItem(SORT_STORAGE_KEY);
    const storedFilter = localStorage.getItem(FILTER_STORAGE_KEY);

    // Only update if valid values found
    if (storedSort && isValidSortOption(storedSort)) {
      setSortByState(storedSort);
    }
    if (storedFilter && isValidFilterOption(storedFilter)) {
      setFilterByState(storedFilter);
    }
  }, []);

  const setSortBy = useCallback((sort: SortOption) => {
    setSortByState(sort);
    localStorage.setItem(SORT_STORAGE_KEY, sort);
  }, []);

  const setFilterBy = useCallback((filter: FilterOption) => {
    setFilterByState(filter);
    localStorage.setItem(FILTER_STORAGE_KEY, filter);
  }, []);

  const isCustomSort = useMemo(() => sortBy === "custom", [sortBy]);

  const hasActiveFilter = useMemo(() => filterBy !== "all", [filterBy]);

  const reset = useCallback(() => {
    setSortBy(DEFAULT_SORT);
    setFilterBy(DEFAULT_FILTER);
  }, [setSortBy, setFilterBy]);

  return {
    sortBy,
    filterBy,
    setSortBy,
    setFilterBy,
    isCustomSort,
    hasActiveFilter,
    reset,
  };
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/hooks/use-items-sort-filter.test.ts`
Expected: PASS

---

## Task 6: Create Sort Dropdown Component

**Files:**

- Create: `components/items/sort-dropdown.tsx`
- Create: `tests/unit/components/items/sort-dropdown.test.tsx`

### Step 1: Write failing tests

```typescript
// tests/unit/components/items/sort-dropdown.test.tsx
/**
 * Unit tests for SortDropdown component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SortDropdown } from "@/components/items/sort-dropdown";

describe("SortDropdown", () => {
  it("renders with current sort option", () => {
    render(<SortDropdown value="custom" onChange={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("Custom Order");
  });

  it("shows all sort options in dropdown", async () => {
    const user = userEvent.setup();
    render(<SortDropdown value="custom" onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Name A-Z")).toBeInTheDocument();
    expect(screen.getByText("Name Z-A")).toBeInTheDocument();
    expect(screen.getByText("Newest First")).toBeInTheDocument();
    expect(screen.getByText("Oldest First")).toBeInTheDocument();
    expect(screen.getByText("Recently Updated")).toBeInTheDocument();
  });

  it("calls onChange when option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<SortDropdown value="custom" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Name A-Z"));

    expect(onChange).toHaveBeenCalledWith("name-asc");
  });

  it("shows check mark on selected option", async () => {
    const user = userEvent.setup();
    render(<SortDropdown value="name-asc" onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    const nameAzOption = screen.getByText("Name A-Z").closest('[role="menuitemradio"]');
    expect(nameAzOption).toHaveAttribute("data-state", "checked");
  });

  it("displays ArrowUpDown icon", () => {
    render(<SortDropdown value="custom" onChange={() => {}} />);

    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<SortDropdown value="custom" onChange={() => {}} disabled />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/components/items/sort-dropdown.test.tsx`
Expected: FAIL - component not found

### Step 3: Implement the component

```typescript
// components/items/sort-dropdown.tsx
/**
 * Dropdown component for selecting item sort order.
 */

"use client";

import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SORT_OPTIONS } from "@/lib/item-utils";
import type { SortOption } from "@/lib/types";

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  disabled?: boolean;
}

/**
 * Dropdown for selecting sort order for items.
 *
 * @param value - Current sort option
 * @param onChange - Callback when sort option changes
 * @param disabled - Whether the dropdown is disabled
 */
export function SortDropdown({ value, onChange, disabled }: SortDropdownProps) {
  const currentLabel = SORT_OPTIONS.find((opt) => opt.value === value)?.label ?? "Sort";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as SortOption)}
        >
          {SORT_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/components/items/sort-dropdown.test.tsx`
Expected: PASS

---

## Task 7: Create Filter Dropdown Component

**Files:**

- Create: `components/items/filter-dropdown.tsx`
- Create: `tests/unit/components/items/filter-dropdown.test.tsx`

### Step 1: Write failing tests

```typescript
// tests/unit/components/items/filter-dropdown.test.tsx
/**
 * Unit tests for FilterDropdown component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FilterDropdown } from "@/components/items/filter-dropdown";

describe("FilterDropdown", () => {
  it("renders with current filter option", () => {
    render(<FilterDropdown value="all" onChange={() => {}} />);

    expect(screen.getByRole("button")).toHaveTextContent("All Items");
  });

  it("shows all filter options in dropdown", async () => {
    const user = userEvent.setup();
    render(<FilterDropdown value="all" onChange={() => {}} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Has Files")).toBeInTheDocument();
    expect(screen.getByText("No Files")).toBeInTheDocument();
    expect(screen.getByText("Synced")).toBeInTheDocument();
    expect(screen.getByText("Pending Sync")).toBeInTheDocument();
    expect(screen.getByText("Sync Error")).toBeInTheDocument();
  });

  it("calls onChange when option is selected", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FilterDropdown value="all" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Has Files"));

    expect(onChange).toHaveBeenCalledWith("has-files");
  });

  it("shows visual indicator when filter is active", () => {
    render(<FilterDropdown value="has-files" onChange={() => {}} />);

    const button = screen.getByRole("button");
    expect(button).toHaveTextContent("Has Files");
    // Active filter should have dot indicator
    expect(button.querySelector('[data-active="true"]')).toBeInTheDocument();
  });

  it("displays Filter icon", () => {
    render(<FilterDropdown value="all" onChange={() => {}} />);

    expect(screen.getByRole("button").querySelector("svg")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(<FilterDropdown value="all" onChange={() => {}} disabled />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/components/items/filter-dropdown.test.tsx`
Expected: FAIL - component not found

### Step 3: Implement the component

```typescript
// components/items/filter-dropdown.tsx
/**
 * Dropdown component for filtering items.
 */

"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FILTER_OPTIONS } from "@/lib/item-utils";
import type { FilterOption } from "@/lib/types";

interface FilterDropdownProps {
  value: FilterOption;
  onChange: (value: FilterOption) => void;
  disabled?: boolean;
}

/**
 * Dropdown for filtering items by various criteria.
 *
 * @param value - Current filter option
 * @param onChange - Callback when filter option changes
 * @param disabled - Whether the dropdown is disabled
 */
export function FilterDropdown({ value, onChange, disabled }: FilterDropdownProps) {
  const currentLabel = FILTER_OPTIONS.find((opt) => opt.value === value)?.label ?? "Filter";
  const isActive = value !== "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Filter className="mr-2 h-4 w-4" />
          {currentLabel}
          {isActive && (
            <span
              data-active="true"
              className="ml-2 h-2 w-2 rounded-full bg-primary"
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as FilterOption)}
        >
          {FILTER_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/components/items/filter-dropdown.test.tsx`
Expected: PASS

---

## Task 8: Create Preferences Tab Component

**Files:**

- Create: `components/profile/preferences-tab.tsx`
- Create: `tests/unit/components/profile/preferences-tab.test.tsx`

### Step 1: Write failing tests

```typescript
// tests/unit/components/profile/preferences-tab.test.tsx
/**
 * Unit tests for PreferencesTab component.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PreferencesTab } from "@/components/profile/preferences-tab";

// Mock server actions
vi.mock("@/lib/user-actions", () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}));

import { getPreferences, updatePreferences } from "@/lib/user-actions";

describe("PreferencesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPreferences).mockResolvedValue({
      success: true,
      data: { viewMode: "grid", sortBy: "custom" },
    });
    vi.mocked(updatePreferences).mockResolvedValue({ success: true });
  });

  it("renders preferences form", async () => {
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByText("Default View")).toBeInTheDocument();
      expect(screen.getByText("Default Sort")).toBeInTheDocument();
    });
  });

  it("loads current preferences on mount", async () => {
    vi.mocked(getPreferences).mockResolvedValue({
      success: true,
      data: { viewMode: "tree", sortBy: "name-asc" },
    });

    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /tree/i })).toBeChecked();
    });
  });

  it("allows changing view mode", async () => {
    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /grid/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /tree/i }));

    expect(screen.getByRole("radio", { name: /tree/i })).toBeChecked();
  });

  it("allows changing sort order", async () => {
    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /sort/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: /sort/i }));
    await user.click(screen.getByText("Name A-Z"));

    expect(screen.getByRole("combobox", { name: /sort/i })).toHaveTextContent("Name A-Z");
  });

  it("saves preferences on save button click", async () => {
    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /grid/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /tree/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith({
        viewMode: "tree",
        sortBy: "custom",
      });
    });
  });

  it("shows success toast on save", async () => {
    const user = userEvent.setup();
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("radio", { name: /grid/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("radio", { name: /tree/i }));
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalled();
    });
  });

  it("disables save button when no changes", async () => {
    render(<PreferencesTab />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    });
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/components/profile/preferences-tab.test.tsx`
Expected: FAIL - component not found

### Step 3: Implement the component

```typescript
// components/profile/preferences-tab.tsx
/**
 * Preferences tab for settings dialog.
 * Manages default view mode and sort order preferences.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, LayoutGrid, List } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { getPreferences, updatePreferences } from "@/lib/user-actions";
import { SORT_OPTIONS } from "@/lib/item-utils";
import type { ViewMode, SortOption } from "@/lib/types";
import { cn } from "@/lib/utils";

// Namespaced localStorage keys (consistent with hook)
const SORT_STORAGE_KEY = "canoncore-items-sort";
const VIEW_STORAGE_KEY = "canoncore-items-view-mode";

interface PreferencesTabProps {
  /** Callback when preferences are saved */
  onSave?: () => void;
}

/**
 * Tab content for managing user preferences.
 *
 * @param onSave - Callback when preferences are saved
 */
export function PreferencesTab({ onSave }: PreferencesTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Current values (from server)
  const [serverViewMode, setServerViewMode] = useState<ViewMode>("grid");
  const [serverSortBy, setServerSortBy] = useState<SortOption>("custom");

  // Form values
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("custom");

  // Load preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      const result = await getPreferences();

      if (result.success && result.data) {
        setServerViewMode(result.data.viewMode);
        setServerSortBy(result.data.sortBy);
        setViewMode(result.data.viewMode);
        setSortBy(result.data.sortBy);
      }

      setIsLoading(false);
    }

    loadPreferences();
  }, []);

  // Check if form has changes
  const isDirty = useMemo(() => {
    return viewMode !== serverViewMode || sortBy !== serverSortBy;
  }, [viewMode, sortBy, serverViewMode, serverSortBy]);

  // Handle save
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      const result = await updatePreferences({ viewMode, sortBy });

      if (result.success) {
        setServerViewMode(viewMode);
        setServerSortBy(sortBy);

        // Update localStorage cache with consistent keys
        localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
        localStorage.setItem(SORT_STORAGE_KEY, sortBy);

        // Dispatch single custom event with all changes (batched)
        window.dispatchEvent(
          new CustomEvent("canoncore-preferences-updated", {
            detail: { viewMode, sortBy },
          })
        );

        toast.success("Preferences saved");
        onSave?.();
      } else {
        toast.error(result.error || "Failed to save preferences");
      }
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  }, [viewMode, sortBy, onSave]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Default View Mode */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Default View</Label>
        <p className="text-muted-foreground text-xs">
          Choose the default view for your items.
        </p>

        <RadioGroup
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
          className="grid grid-cols-2 gap-4"
        >
          <Label
            htmlFor="view-grid"
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
              viewMode === "grid"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value="grid" id="view-grid" className="sr-only" />
            <LayoutGrid
              className={cn(
                "size-8",
                viewMode === "grid" ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                viewMode === "grid" ? "text-primary" : "text-foreground"
              )}
            >
              Grid
            </span>
            <span className="text-muted-foreground text-xs">
              Poster card layout
            </span>
          </Label>

          <Label
            htmlFor="view-tree"
            className={cn(
              "flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors",
              viewMode === "tree"
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted/50"
            )}
          >
            <RadioGroupItem value="tree" id="view-tree" className="sr-only" />
            <List
              className={cn(
                "size-8",
                viewMode === "tree" ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span
              className={cn(
                "text-sm font-medium",
                viewMode === "tree" ? "text-primary" : "text-foreground"
              )}
            >
              Tree
            </span>
            <span className="text-muted-foreground text-xs">
              Hierarchical list
            </span>
          </Label>
        </RadioGroup>
      </div>

      <Separator />

      {/* Default Sort Order */}
      <div className="space-y-3">
        <Label htmlFor="sort-select" className="text-sm font-medium">
          Default Sort
        </Label>
        <p className="text-muted-foreground text-xs">
          Choose the default sort order for your items.
        </p>

        <Select
          value={sortBy}
          onValueChange={(value) => setSortBy(value as SortOption)}
        >
          <SelectTrigger id="sort-select" aria-label="Sort" className="w-full">
            <SelectValue placeholder="Select sort order" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {sortBy !== "custom" && (
          <p className="text-muted-foreground text-xs">
            Note: Drag-and-drop reordering requires "Custom Order" sort.
          </p>
        )}
      </div>

      <Separator />

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Preferences"
          )}
        </Button>
      </div>
    </div>
  );
}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/components/profile/preferences-tab.test.tsx`
Expected: PASS

---

## Task 9: Add Tabs to Settings Dialog

**Files:**

- Modify: `components/profile/settings-dialog.tsx`
- Modify: `tests/unit/components/profile/settings-dialog.test.tsx`

### Step 1: Add tests for tabbed layout

Add to existing test file:

```typescript
// Add to tests/unit/components/profile/settings-dialog.test.tsx

describe("Settings tabs", () => {
  it("renders Profile and Preferences tabs", () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    expect(screen.getByRole("tab", { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /preferences/i })).toBeInTheDocument();
  });

  it("shows Profile tab content by default", () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    expect(screen.getByText("Display Name")).toBeInTheDocument();
  });

  it("switches to Preferences tab on click", async () => {
    const user = userEvent.setup();
    render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    await user.click(screen.getByRole("tab", { name: /preferences/i }));

    expect(screen.getByText("Default View")).toBeInTheDocument();
    expect(screen.getByText("Default Sort")).toBeInTheDocument();
  });

  it("preserves tab state when reopening dialog", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    await user.click(screen.getByRole("tab", { name: /preferences/i }));

    // Close and reopen
    rerender(
      <SettingsDialog
        open={false}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );
    rerender(
      <SettingsDialog
        open={true}
        onOpenChange={() => {}}
        user={mockUser}
        googleDriveConnection={null}
      />
    );

    // Should reset to Profile tab
    expect(screen.getByText("Display Name")).toBeInTheDocument();
  });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm test tests/unit/components/profile/settings-dialog.test.tsx`
Expected: FAIL - tabs not implemented

### Step 3: Update Settings Dialog with tabs

Update `components/profile/settings-dialog.tsx`:

1. Add imports:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreferencesTab } from "./preferences-tab";
import { User, SlidersHorizontal } from "lucide-react";
```

2. Add tab state to SettingsDialog:

```typescript
const [activeTab, setActiveTab] = useState<"profile" | "preferences">(
  "profile"
);

// Reset tab when dialog opens
useEffect(() => {
  if (open) {
    setActiveTab("profile");
    setCurrentStep("main");
  }
}, [open]);
```

3. Wrap MainSettingsContent in tabs:

```typescript
{currentStep === "main" && (
  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "profile" | "preferences")}>
    <DialogHeader>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            "bg-primary/10 ring-primary/20 ring-1"
          )}
        >
          <Settings className="text-primary size-5" />
        </div>
        <div className="min-w-0">
          <DialogTitle className="text-lg">Settings</DialogTitle>
          <DialogDescription className="text-sm">
            Manage your account and preferences
          </DialogDescription>
        </div>
      </div>
    </DialogHeader>

    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="profile" className="gap-2">
        <User className="size-4" />
        Profile
      </TabsTrigger>
      <TabsTrigger value="preferences" className="gap-2">
        <SlidersHorizontal className="size-4" />
        Preferences
      </TabsTrigger>
    </TabsList>

    <TabsContent value="profile" className="mt-4">
      <MainSettingsContent
        user={user}
        googleDriveConnection={googleDriveConnection}
        onProfileChange={onProfileChange}
        onOpenChange={onOpenChange}
        onPasswordClick={() => setCurrentStep("password")}
        onEmailClick={() => setCurrentStep("email")}
      />
    </TabsContent>

    <TabsContent value="preferences" className="mt-4">
      <PreferencesTab onSave={() => onOpenChange(false)} />
    </TabsContent>
  </Tabs>
)}
```

### Step 4: Run tests to verify they pass

Run: `pnpm test tests/unit/components/profile/settings-dialog.test.tsx`
Expected: PASS

---

## Task 10: Update ItemsToolbar with Sort/Filter

**Files:**

- Modify: `components/items/items-toolbar.tsx`
- Modify: `tests/unit/components/items/items-toolbar.test.tsx`

(Implementation details as in original plan Task 5)

---

## Task 11: Integrate Sort/Filter into ItemsView

**Files:**

- Modify: `components/items/items-view.tsx`
- Modify: `tests/unit/components/items/items-view.test.tsx`

(Implementation details as in original plan Task 6)

---

## Task 12: Update view-toggle.tsx to Use Centralized Types

**Files:**

- Modify: `components/items/view-toggle.tsx`

### Step 1: Update imports

Change ViewMode import to use centralized types:

```typescript
// Before
export type ViewMode = "grid" | "tree";

// After
import type { ViewMode } from "@/lib/types";
export type { ViewMode };
```

---

## Task 13: Add E2E Tests

**Files:**

- Modify: `e2e/pages/items.page.ts`
- Modify: `e2e/pages/settings.page.ts`
- Create: `e2e/journeys/items/items-sort-filter.spec.ts`
- Create: `e2e/journeys/profile/preferences.spec.ts`

### Step 1: Update Settings Page Object

```typescript
// Add to e2e/pages/settings.page.ts

readonly preferencesTab = this.page.getByRole("tab", { name: /preferences/i });
readonly profileTab = this.page.getByRole("tab", { name: /profile/i });
readonly viewModeGrid = this.page.getByRole("radio", { name: /grid/i });
readonly viewModeTree = this.page.getByRole("radio", { name: /tree/i });
readonly sortSelect = this.page.getByRole("combobox", { name: /sort/i });
readonly savePreferencesButton = this.page.getByRole("button", { name: /save preferences/i });

async goToPreferences() {
  await this.preferencesTab.click();
}

async setViewMode(mode: "grid" | "tree") {
  if (mode === "grid") {
    await this.viewModeGrid.click();
  } else {
    await this.viewModeTree.click();
  }
}

async setSortOrder(option: string) {
  await this.sortSelect.click();
  await this.page.getByRole("option", { name: option }).click();
}

async savePreferences() {
  await this.savePreferencesButton.click();
}
```

### Step 2: Create Preferences E2E tests

```typescript
// e2e/journeys/profile/preferences.spec.ts
/**
 * E2E tests for user preferences.
 */

import { test, expect } from "../../fixtures/auth.fixture";

test.describe("User Preferences", () => {
  test.beforeEach(async ({ settingsPage }) => {
    await settingsPage.open();
    await settingsPage.goToPreferences();
  });

  test("can set default view mode to tree", async ({
    settingsPage,
    itemsPage,
    page,
  }) => {
    await settingsPage.setViewMode("tree");
    await settingsPage.savePreferences();

    // Navigate to items and verify tree view is active
    await itemsPage.goto();
    await page.reload();

    await expect(
      itemsPage.page.getByRole("button", { name: /tree/i })
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("can set default sort order", async ({
    settingsPage,
    itemsPage,
    page,
  }) => {
    await settingsPage.setSortOrder("Name A-Z");
    await settingsPage.savePreferences();

    // Navigate to items and verify sort is applied
    await itemsPage.goto();
    await page.reload();

    await expect(itemsPage.sortDropdown).toHaveText(/name a-z/i);
  });

  test("preferences persist across sessions", async ({
    settingsPage,
    page,
    context,
  }) => {
    await settingsPage.setViewMode("tree");
    await settingsPage.setSortOrder("Newest First");
    await settingsPage.savePreferences();

    // Clear only preference-related localStorage keys (selective clearing)
    await page.evaluate(() => {
      localStorage.removeItem("canoncore-items-sort");
      localStorage.removeItem("canoncore-items-filter");
      localStorage.removeItem("canoncore-items-view-mode");
    });
    await page.reload();

    // Open settings again
    await settingsPage.open();
    await settingsPage.goToPreferences();

    // Preferences should be loaded from database
    await expect(settingsPage.viewModeTree).toBeChecked();
  });
});
```

### Step 3: Create Items Sort/Filter E2E tests

(Implementation details as in original plan Task 7)

---

## Task 14: Run Full Test Suite

### Step 1: Run check script

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

### Step 2: Run unit tests

Run: `pnpm test`
Expected: All unit tests pass

### Step 3: Run E2E tests

Run: `pnpm test:e2e`
Expected: All E2E tests pass

---

## Summary

| File                                                     | Action | Purpose                                                     |
| -------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `prisma/schema.prisma`                                   | Modify | Add defaultViewMode, defaultSortBy to User                  |
| `lib/types.ts`                                           | Modify | Add ViewMode, SortOption, FilterOption types and validators |
| `lib/user-actions.ts`                                    | Modify | Add getPreferences, updatePreferences with @example JSDoc   |
| `lib/item-utils.ts`                                      | Modify | Add sortItems, filterItems with @example JSDoc              |
| `hooks/use-items-sort-filter.ts`                         | Create | SSR-safe state hook with localStorage validation            |
| `components/items/sort-dropdown.tsx`                     | Create | Sort selection dropdown                                     |
| `components/items/filter-dropdown.tsx`                   | Create | Filter selection dropdown                                   |
| `components/items/items-toolbar.tsx`                     | Modify | Add sort/filter dropdowns                                   |
| `components/items/items-view.tsx`                        | Modify | Apply sort/filter to items                                  |
| `components/items/view-toggle.tsx`                       | Modify | Import ViewMode from lib/types.ts                           |
| `components/profile/settings-dialog.tsx`                 | Modify | Add tabbed layout                                           |
| `components/profile/preferences-tab.tsx`                 | Create | Preferences configuration UI with batched events            |
| `tests/unit/lib/user-actions-preferences.test.ts`        | Create | Server action tests                                         |
| `tests/unit/lib/item-utils-sort-filter.test.ts`          | Create | Utility tests with edge cases                               |
| `tests/unit/hooks/use-items-sort-filter.test.ts`         | Create | Hook tests with validation tests                            |
| `tests/unit/components/items/sort-dropdown.test.tsx`     | Create | Component tests                                             |
| `tests/unit/components/items/filter-dropdown.test.tsx`   | Create | Component tests                                             |
| `tests/unit/components/profile/preferences-tab.test.tsx` | Create | Component tests                                             |
| `e2e/pages/settings.page.ts`                             | Modify | Add preferences helpers                                     |
| `e2e/journeys/profile/preferences.spec.ts`               | Create | Preferences E2E tests                                       |
| `e2e/journeys/items/items-sort-filter.spec.ts`           | Create | Sort/filter E2E tests                                       |

**Key Behaviors:**

1. Default view is "Grid", default sort is "Custom Order"
2. Preferences saved to database via Settings > Preferences tab
3. localStorage used as cache for fast hydration (namespaced keys: `canoncore-*`)
4. SSR-safe initialization: defaults on server, sync from localStorage after mount
5. When sort ≠ custom, edit mode (drag-drop) is disabled
6. Filter empty state shows clear button
7. Preferences sync across devices (database-backed)
8. Sort/filter apply to current level only
9. Invalid localStorage values are ignored (type guards validate)
10. Custom event batches preference updates for efficiency
