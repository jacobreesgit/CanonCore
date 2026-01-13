# Empty States, Seeding Flags & Bulk Operations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add contextual empty states for edge cases, additional seeding configuration flags, and multi-select bulk delete functionality in edit mode.

**Architecture:** Empty states use conditional rendering based on items state and filter context. Seeding flags are environment variables parsed in seed-config.ts. Bulk operations use a selection Set in ItemsView with checkboxes in edit mode.

**Tech Stack:** React state, Prisma seed script, dnd-kit, shadcn Checkbox, existing item-actions.ts

**Prerequisites:** This plan builds on `2026-01-13-batch-operations.md` which provides Drive-level `batchDelete`. The `deleteItems` action in Task 7 may internally use `batchDelete` for efficient Drive cleanup when deleting items with Drive files.

---

## Feature 1: Contextual Empty States

### Problem

Currently, there's a single empty state shown when `items.length === 0`. This doesn't distinguish between:

- First-time user with no content
- Filtered results yielding zero items
- Child page with no children
- Search results with no matches

### Solution

Create contextual empty states that provide helpful guidance based on the current context.

### Empty State Variants

| Variant        | Condition                      | Icon       | Title               | Description                           | Action       |
| -------------- | ------------------------------ | ---------- | ------------------- | ------------------------------------- | ------------ |
| `first-time`   | Root page, no items, no filter | Folder     | "No items yet"      | "Create your first item..."           | Add Item     |
| `no-children`  | Detail page, no children       | FolderOpen | "No child items"    | "Add child items..."                  | Add Child    |
| `filter-empty` | Filter active, 0 results       | FilterX    | "No matching items" | "No items match your current filter." | Clear Filter |
| `search-empty` | Search active, 0 results       | Search     | "No results"        | "No items match your search."         | Clear Search |

> **Note:** The `search-empty` variant is reserved for future inline search functionality. Current search uses global Spotlight (via "/" shortcut) which has its own empty state.

---

## Feature 2: Seeding Flags

### Problem

Current seeding requires all content (movies + TV shows) with Drive integration. For development/testing, it would be useful to:

- Seed only movies or only TV shows
- Skip Google Drive uploads (faster, no credentials needed)
- Customize which users to seed
- Control verbose output

### Solution

Add environment variable flags parsed in `seed-config.ts`.

### New Seeding Flags

| Flag                | Type    | Default | Purpose                                      |
| ------------------- | ------- | ------- | -------------------------------------------- |
| `SEED_ONLY_MOVIES`  | boolean | false   | Skip TV shows, seed only movies              |
| `SEED_ONLY_SHOWS`   | boolean | false   | Skip movies, seed only TV shows              |
| `SEED_SKIP_DRIVE`   | boolean | false   | Skip Google Drive uploads (faster, no creds) |
| `SEED_SKIP_ARTWORK` | boolean | false   | Skip downloading/uploading posters           |
| `SEED_USER_EMAIL`   | string  | null    | Override to seed single user only            |
| `SEED_QUIET`        | boolean | false   | Suppress progress output                     |
| `SEED_MOVIE_COUNT`  | number  | all     | Limit number of movies to seed               |
| `SEED_SHOW_COUNT`   | number  | all     | Limit number of TV shows to seed             |

---

## Feature 3: Bulk Operations (Multi-Select Delete)

### Problem

Deleting 10 items requires 10 right-click → delete → confirm sequences. In edit mode, users should be able to select multiple items and delete them in one action.

### Solution

In edit mode, show checkboxes on items. When items are selected, show a bulk actions toolbar with "Delete Selected" button. Uses existing `deleteItem` server action in a loop (or new `deleteItems` batch action).

### UI/UX Design

1. **Selection State**: `Set<string>` of selected item IDs in ItemsView
2. **Checkboxes**: Appear on items only in edit mode
3. **Bulk Toolbar**: Shows above items when selection > 0
4. **Select All**: Header checkbox for select/deselect all
5. **Confirmation**: Single modal for bulk delete with count

---

## Task 1: Create Empty State Variants Component

> **Note:** An inline `EmptyState` function already exists in `items-view.tsx:575-608` handling only the first-time case. This task extracts and extends it into a reusable component with multiple variants.

**Files:**

- Create: `components/items/empty-state.tsx`
- Test: `tests/unit/components/items/empty-state.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/components/items/empty-state.test.tsx`:

```typescript
/**
 * Unit tests for empty state variants.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { EmptyState, EmptyStateVariant } from "@/components/items/empty-state";

describe("EmptyState", () => {
  describe("first-time variant", () => {
    it("renders first-time empty state", () => {
      render(
        <EmptyState variant="first-time" onAction={() => {}} />
      );

      expect(screen.getByText("No items yet")).toBeInTheDocument();
      expect(screen.getByText(/create your first item/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
    });

    it("calls onAction when button is clicked", async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();
      render(<EmptyState variant="first-time" onAction={onAction} />);

      await user.click(screen.getByRole("button", { name: /add item/i }));

      expect(onAction).toHaveBeenCalled();
    });
  });

  describe("no-children variant", () => {
    it("renders no-children empty state", () => {
      render(
        <EmptyState variant="no-children" onAction={() => {}} />
      );

      expect(screen.getByText("No child items")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /add child/i })).toBeInTheDocument();
    });
  });

  describe("filter-empty variant", () => {
    it("renders filter-empty empty state", () => {
      render(
        <EmptyState variant="filter-empty" onAction={() => {}} />
      );

      expect(screen.getByText("No matching items")).toBeInTheDocument();
      expect(screen.getByText(/no items match your current filter/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /clear filter/i })).toBeInTheDocument();
    });

    it("calls onAction to clear filter", async () => {
      const onAction = vi.fn();
      const user = userEvent.setup();
      render(<EmptyState variant="filter-empty" onAction={onAction} />);

      await user.click(screen.getByRole("button", { name: /clear filter/i }));

      expect(onAction).toHaveBeenCalled();
    });
  });

  describe("search-empty variant", () => {
    it("renders search-empty empty state", () => {
      render(
        <EmptyState variant="search-empty" onAction={() => {}} />
      );

      expect(screen.getByText("No results")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /clear search/i })).toBeInTheDocument();
    });
  });

  it("renders without action button when onAction is not provided", () => {
    render(<EmptyState variant="first-time" />);

    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/empty-state.test.tsx`
Expected: FAIL - module doesn't exist

### Step 3: Write minimal implementation

Create `components/items/empty-state.tsx`:

```typescript
/**
 * Contextual empty state component for items views.
 * Displays different messages and actions based on the current context.
 */

"use client";

import { Folder, FolderOpen, FilterX, Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EmptyStateVariant =
  | "first-time"
  | "no-children"
  | "filter-empty"
  | "search-empty";

interface EmptyStateConfig {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel: string;
}

const EMPTY_STATE_CONFIG: Record<EmptyStateVariant, EmptyStateConfig> = {
  "first-time": {
    icon: Folder,
    title: "No items yet",
    description: "Create your first item to get started organizing your media library.",
    actionLabel: "Add Item",
  },
  "no-children": {
    icon: FolderOpen,
    title: "No child items",
    description: "Add child items to organize content within this folder.",
    actionLabel: "Add Child",
  },
  "filter-empty": {
    icon: FilterX,
    title: "No matching items",
    description: "No items match your current filter. Try adjusting your filter criteria.",
    actionLabel: "Clear Filter",
  },
  "search-empty": {
    icon: Search,
    title: "No results",
    description: "No items match your search. Try different keywords.",
    actionLabel: "Clear Search",
  },
};

interface EmptyStateProps {
  /** The variant of empty state to display */
  variant: EmptyStateVariant;
  /** Optional callback for the action button */
  onAction?: () => void;
  /** Optional custom class name */
  className?: string;
}

/**
 * Displays a contextual empty state based on the current view context.
 *
 * @param variant - The type of empty state to show
 * @param onAction - Callback when the action button is clicked
 * @param className - Additional CSS classes
 *
 * @example
 * // First-time user with no items
 * <EmptyState variant="first-time" onAction={() => setAddItemOpen(true)} />
 *
 * @example
 * // Filter yielded no results
 * <EmptyState variant="filter-empty" onAction={() => setFilterBy("all")} />
 */
export function EmptyState({ variant, onAction, className }: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-4 p-8",
        className
      )}
    >
      <div className="bg-muted/50 flex size-16 items-center justify-center rounded-full">
        <Icon className="text-muted-foreground size-8" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-medium">{config.title}</h3>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {config.description}
        </p>
      </div>
      {onAction && (
        <Button onClick={onAction} variant="outline" className="mt-2">
          {variant === "first-time" || variant === "no-children" ? (
            <Plus className="mr-2 size-4" />
          ) : null}
          {config.actionLabel}
        </Button>
      )}
    </div>
  );
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/empty-state.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/empty-state.tsx tests/unit/components/items/empty-state.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): add contextual empty state component

Provides different empty states for first-time users, empty
children, filter results, and search results with appropriate
icons, messages, and action buttons.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Integrate Empty States into ItemsView

**Files:**

- Modify: `components/items/items-view.tsx`
- Modify: `tests/unit/components/items-view.test.tsx`

### Step 1: Write the failing test

Add to `tests/unit/components/items-view.test.tsx`:

```typescript
describe("empty states", () => {
  it("shows first-time empty state when no items and no filter", async () => {
    render(
      <ItemsView
        items={[]}
        parentId={null}
        hasDriveConnection={false}
      />
    );

    expect(screen.getByText("No items yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
  });

  it("shows no-children empty state on detail page with no children", async () => {
    render(
      <ItemsView
        items={[]}
        parentId="parent-123"
        hasDriveConnection={false}
      />
    );

    expect(screen.getByText("No child items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add child/i })).toBeInTheDocument();
  });

  it("shows filter-empty state when filter active and no results", async () => {
    // Mock hook to return active filter
    vi.mocked(useItemsSortFilter).mockReturnValue({
      sortBy: "custom",
      filterBy: "has-files",
      isCustomSort: true,
      hasActiveFilter: true,
      setSortBy: vi.fn(),
      setFilterBy: vi.fn(),
      reset: vi.fn(),
    });

    render(
      <ItemsView
        items={[]}
        parentId={null}
        hasDriveConnection={false}
      />
    );

    expect(screen.getByText("No matching items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear filter/i })).toBeInTheDocument();
  });

  it("clears filter when clear filter button is clicked", async () => {
    const mockSetFilterBy = vi.fn();
    vi.mocked(useItemsSortFilter).mockReturnValue({
      sortBy: "custom",
      filterBy: "has-files",
      isCustomSort: true,
      hasActiveFilter: true,
      setSortBy: vi.fn(),
      setFilterBy: mockSetFilterBy,
      reset: vi.fn(),
    });

    const user = userEvent.setup();
    render(
      <ItemsView
        items={[]}
        parentId={null}
        hasDriveConnection={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /clear filter/i }));

    expect(mockSetFilterBy).toHaveBeenCalledWith("all");
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items-view.test.tsx -t "empty states"`
Expected: FAIL - current empty state doesn't match

### Step 3: Update ItemsView to use contextual empty states

In `components/items/items-view.tsx`, update the empty state logic:

```typescript
import { EmptyState, type EmptyStateVariant } from "./empty-state";

// Inside ItemsView component, replace the existing EmptyState with:

// Determine empty state variant
const getEmptyStateVariant = (): EmptyStateVariant => {
  if (hasActiveFilter) return "filter-empty";
  if (parentId) return "no-children";
  return "first-time";
};

const handleEmptyStateAction = () => {
  const variant = getEmptyStateVariant();
  if (variant === "filter-empty") {
    setFilterBy("all");
  } else {
    // Open add item dialog
    setAddItemDialogOpen(true);
  }
};

// In render, replace existing empty state:
{displayItems.length === 0 ? (
  <EmptyState
    variant={getEmptyStateVariant()}
    onAction={handleEmptyStateAction}
  />
) : (
  // ... existing tree/grid rendering
)}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items-view.test.tsx -t "empty states"`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/items-view.tsx tests/unit/components/items-view.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): integrate contextual empty states

Shows different empty states based on context:
- first-time: Root page with no items
- no-children: Detail page with no children
- filter-empty: Active filter with no results

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Seeding Flags to Configuration

**Files:**

- Modify: `prisma/seed-config.ts`
- Create: `tests/unit/prisma/seed-config.test.ts`

### Step 1: Write the failing test

Create `tests/unit/prisma/seed-config.test.ts`:

```typescript
/**
 * Unit tests for seed configuration flags.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("seed-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("parses SEED_ONLY_MOVIES flag", async () => {
    process.env.SEED_ONLY_MOVIES = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_ONLY_MOVIES).toBe(true);
  });

  it("parses SEED_ONLY_SHOWS flag", async () => {
    process.env.SEED_ONLY_SHOWS = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_ONLY_SHOWS).toBe(true);
  });

  it("parses SEED_SKIP_DRIVE flag", async () => {
    process.env.SEED_SKIP_DRIVE = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_SKIP_DRIVE).toBe(true);
  });

  it("parses SEED_SKIP_ARTWORK flag", async () => {
    process.env.SEED_SKIP_ARTWORK = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_SKIP_ARTWORK).toBe(true);
  });

  it("parses SEED_QUIET flag", async () => {
    process.env.SEED_QUIET = "true";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_QUIET).toBe(true);
  });

  it("parses SEED_MOVIE_COUNT as number", async () => {
    process.env.SEED_MOVIE_COUNT = "5";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_MOVIE_COUNT).toBe(5);
  });

  it("parses SEED_SHOW_COUNT as number", async () => {
    process.env.SEED_SHOW_COUNT = "3";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_SHOW_COUNT).toBe(3);
  });

  it("parses SEED_USER_EMAIL as string", async () => {
    process.env.SEED_USER_EMAIL = "custom@test.com";
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_USER_EMAIL).toBe("custom@test.com");
  });

  it("defaults boolean flags to false", async () => {
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_ONLY_MOVIES).toBe(false);
    expect(config.SEED_ONLY_SHOWS).toBe(false);
    expect(config.SEED_SKIP_DRIVE).toBe(false);
    expect(config.SEED_SKIP_ARTWORK).toBe(false);
    expect(config.SEED_QUIET).toBe(false);
  });

  it("defaults count flags to 0 (unlimited)", async () => {
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_MOVIE_COUNT).toBe(0);
    expect(config.SEED_SHOW_COUNT).toBe(0);
  });

  it("defaults SEED_USER_EMAIL to null", async () => {
    const config = await import("@/prisma/seed-config");
    expect(config.SEED_USER_EMAIL).toBe(null);
  });

  it("getEffectiveMovieIds returns limited movies when SEED_MOVIE_COUNT set", async () => {
    process.env.SEED_MOVIE_COUNT = "3";
    const config = await import("@/prisma/seed-config");
    const ids = config.getEffectiveMovieIds();
    expect(ids).toHaveLength(3);
  });

  it("getEffectiveMovieIds returns empty when SEED_ONLY_SHOWS is true", async () => {
    process.env.SEED_ONLY_SHOWS = "true";
    const config = await import("@/prisma/seed-config");
    const ids = config.getEffectiveMovieIds();
    expect(ids).toHaveLength(0);
  });

  it("getEffectiveTVShowIds returns empty when SEED_ONLY_MOVIES is true", async () => {
    process.env.SEED_ONLY_MOVIES = "true";
    const config = await import("@/prisma/seed-config");
    const ids = config.getEffectiveTVShowIds();
    expect(ids).toHaveLength(0);
  });

  it("getEffectiveSeedUsers returns single user when SEED_USER_EMAIL set", async () => {
    process.env.SEED_USER_EMAIL = "custom@test.com";
    const config = await import("@/prisma/seed-config");
    const users = config.getEffectiveSeedUsers();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe("custom@test.com");
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/prisma/seed-config.test.ts`
Expected: FAIL - new exports don't exist

### Step 3: Update seed-config.ts with new flags

Update `prisma/seed-config.ts`:

```typescript
/**
 * Seed configuration for populating the database with demo content.
 * Uses TMDB IDs to fetch real movie and TV show metadata.
 *
 * Environment Variables:
 *   - SEED_MAX_SEASONS: Max seasons per show (0 = unlimited, default: 2)
 *   - SEED_MAX_EPISODES: Max episodes per season (0 = unlimited, default: 10)
 *   - SEED_RANDOM_SEED: Seed for reproducible random file counts (default: null = Math.random)
 *   - SEED_ONLY_MOVIES: Skip TV shows, seed only movies (default: false)
 *   - SEED_ONLY_SHOWS: Skip movies, seed only TV shows (default: false)
 *   - SEED_SKIP_DRIVE: Skip Google Drive uploads (default: false)
 *   - SEED_SKIP_ARTWORK: Skip downloading/uploading artwork (default: false)
 *   - SEED_QUIET: Suppress progress output (default: false)
 *   - SEED_MOVIE_COUNT: Limit number of movies (0 = all, default: 0)
 *   - SEED_SHOW_COUNT: Limit number of TV shows (0 = all, default: 0)
 *   - SEED_USER_EMAIL: Override to seed single user only (default: null)
 *   - TMDB_API_DELAY_MS is hardcoded at 100ms for rate limiting
 */

/** Helper to parse boolean env vars. */
function parseBooleanEnv(value: string | undefined): boolean {
  return value?.toLowerCase() === "true";
}

// Existing flags
export const MAX_SEASONS = parseInt(process.env.SEED_MAX_SEASONS || "2", 10);
export const MAX_EPISODES = parseInt(process.env.SEED_MAX_EPISODES || "10", 10);
export const RANDOM_SEED = process.env.SEED_RANDOM_SEED
  ? parseInt(process.env.SEED_RANDOM_SEED, 10)
  : null;
export const TMDB_API_DELAY_MS = 100;

// New boolean flags
export const SEED_ONLY_MOVIES = parseBooleanEnv(process.env.SEED_ONLY_MOVIES);
export const SEED_ONLY_SHOWS = parseBooleanEnv(process.env.SEED_ONLY_SHOWS);
export const SEED_SKIP_DRIVE = parseBooleanEnv(process.env.SEED_SKIP_DRIVE);
export const SEED_SKIP_ARTWORK = parseBooleanEnv(process.env.SEED_SKIP_ARTWORK);
export const SEED_QUIET = parseBooleanEnv(process.env.SEED_QUIET);

// New count flags
export const SEED_MOVIE_COUNT = parseInt(
  process.env.SEED_MOVIE_COUNT || "0",
  10
);
export const SEED_SHOW_COUNT = parseInt(process.env.SEED_SHOW_COUNT || "0", 10);

// New string flags
export const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL || null;

/** Movie TMDB IDs to seed. */
export const MOVIE_IDS = [
  278, // The Shawshank Redemption
  238, // The Godfather
  240, // The Godfather Part II
  424, // Schindler's List
  389, // 12 Angry Men
  129, // Spirited Away
  19404, // Dilwale Dulhania Le Jayenge
  496243, // Parasite
  637, // Life Is Beautiful
  155, // The Dark Knight
];

/** TV Show TMDB IDs to seed. */
export const TV_SHOW_IDS = [
  57243, // Doctor Who (2005)
  1396, // Breaking Bad
  1399, // Game of Thrones
  60625, // Rick and Morty
  1418, // The Big Bang Theory
  456, // The Simpsons
  66732, // Stranger Things
  1100, // How I Met Your Mother
  71912, // The Witcher
  84958, // Loki
];

/** Seed user configuration. */
export const SEED_USERS = [
  {
    email: "demo@canoncore.com",
    name: "Demo User",
  },
  {
    email: "test@canoncore.com",
    name: "Test User",
  },
];

/** Default password for seed users (override with SEED_PASSWORD env var). */
export const DEFAULT_SEED_PASSWORD = "SeedPassword123!";

/** Folder name created in Google Drive for seeded content. */
export const SEED_DRIVE_FOLDER_NAME = "CanonCore-Seed";

/** Protected folders that should never be deleted during cleanup. */
export const PROTECTED_FOLDERS = ["Breaking Bad", "CanonCore"];

/**
 * Returns effective movie IDs based on flags.
 * Respects SEED_ONLY_SHOWS and SEED_MOVIE_COUNT.
 */
export function getEffectiveMovieIds(): number[] {
  if (SEED_ONLY_SHOWS) return [];
  if (SEED_MOVIE_COUNT > 0) return MOVIE_IDS.slice(0, SEED_MOVIE_COUNT);
  return MOVIE_IDS;
}

/**
 * Returns effective TV show IDs based on flags.
 * Respects SEED_ONLY_MOVIES and SEED_SHOW_COUNT.
 */
export function getEffectiveTVShowIds(): number[] {
  if (SEED_ONLY_MOVIES) return [];
  if (SEED_SHOW_COUNT > 0) return TV_SHOW_IDS.slice(0, SEED_SHOW_COUNT);
  return TV_SHOW_IDS;
}

/**
 * Returns effective seed users based on flags.
 * Respects SEED_USER_EMAIL to filter to single user.
 */
export function getEffectiveSeedUsers(): typeof SEED_USERS {
  if (SEED_USER_EMAIL) {
    return [
      {
        email: SEED_USER_EMAIL,
        name: SEED_USER_EMAIL.split("@")[0],
      },
    ];
  }
  return SEED_USERS;
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/prisma/seed-config.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add prisma/seed-config.ts tests/unit/prisma/seed-config.test.ts
git commit -m "$(cat <<'EOF'
feat(seed): add configuration flags for flexible seeding

New flags:
- SEED_ONLY_MOVIES/SEED_ONLY_SHOWS: Content type filtering
- SEED_SKIP_DRIVE/SEED_SKIP_ARTWORK: Skip expensive operations
- SEED_QUIET: Suppress output
- SEED_MOVIE_COUNT/SEED_SHOW_COUNT: Limit content amount
- SEED_USER_EMAIL: Override to seed single user

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update Seed Script to Use New Flags

**Files:**

- Modify: `prisma/seed.ts`

### Step 1: Update imports in seed.ts

```typescript
import {
  MOVIE_IDS,
  TV_SHOW_IDS,
  SEED_USERS,
  DEFAULT_SEED_PASSWORD,
  MAX_SEASONS,
  MAX_EPISODES,
  RANDOM_SEED,
  TMDB_API_DELAY_MS,
  // New imports
  SEED_SKIP_DRIVE,
  SEED_SKIP_ARTWORK,
  SEED_QUIET,
  getEffectiveMovieIds,
  getEffectiveTVShowIds,
  getEffectiveSeedUsers,
} from "./seed-config";
```

### Step 2: Add conditional logging helper

```typescript
/** Logs message if not in quiet mode. */
function log(message: string) {
  if (!SEED_QUIET) {
    console.log(message);
  }
}
```

### Step 3: Update seed functions to use effective getters and flags

Replace direct uses of `MOVIE_IDS`, `TV_SHOW_IDS`, `SEED_USERS` with:

```typescript
const movieIds = getEffectiveMovieIds();
const tvShowIds = getEffectiveTVShowIds();
const seedUsers = getEffectiveSeedUsers();
```

Wrap Drive operations with:

```typescript
if (!SEED_SKIP_DRIVE) {
  // Drive upload code
}
```

Wrap artwork downloads with:

```typescript
if (!SEED_SKIP_ARTWORK) {
  // Poster/backdrop download code
}
```

### Step 4: Commit

```bash
git add prisma/seed.ts
git commit -m "$(cat <<'EOF'
feat(seed): integrate new configuration flags

Seed script now respects:
- SEED_SKIP_DRIVE: Skips all Google Drive operations
- SEED_SKIP_ARTWORK: Skips poster/backdrop downloads
- SEED_QUIET: Suppresses progress output
- Count limits via getEffective* helpers

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create Bulk Selection State Hook

**Files:**

- Create: `hooks/use-bulk-selection.ts`
- Create: `tests/unit/hooks/use-bulk-selection.test.ts`

### Step 1: Write the failing test

Create `tests/unit/hooks/use-bulk-selection.test.ts`:

```typescript
/**
 * Unit tests for useBulkSelection hook.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useBulkSelection } from "@/hooks/use-bulk-selection";

describe("useBulkSelection", () => {
  const mockItems = [
    { id: "1", name: "Item 1" },
    { id: "2", name: "Item 2" },
    { id: "3", name: "Item 3" },
  ];

  it("starts with empty selection", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    expect(result.current.selectedIds.size).toBe(0);
    expect(result.current.selectionCount).toBe(0);
  });

  it("toggles single item selection", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(true);
    expect(result.current.selectionCount).toBe(1);

    act(() => {
      result.current.toggleItem("1");
    });

    expect(result.current.selectedIds.has("1")).toBe(false);
    expect(result.current.selectionCount).toBe(0);
  });

  it("selects all items", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectionCount).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it("deselects all items", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.selectAll();
    });

    act(() => {
      result.current.deselectAll();
    });

    expect(result.current.selectionCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it("returns isSelected helper", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("2");
    });

    expect(result.current.isSelected("1")).toBe(false);
    expect(result.current.isSelected("2")).toBe(true);
  });

  it("toggles all when some selected", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("1");
    });

    expect(result.current.isPartiallySelected).toBe(true);

    act(() => {
      result.current.toggleAll();
    });

    // When partially selected, toggleAll should select all
    expect(result.current.isAllSelected).toBe(true);

    act(() => {
      result.current.toggleAll();
    });

    // When all selected, toggleAll should deselect all
    expect(result.current.selectionCount).toBe(0);
  });

  it("clears selection when items change", () => {
    const { result, rerender } = renderHook(
      ({ items }) => useBulkSelection(items),
      { initialProps: { items: mockItems } }
    );

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectionCount).toBe(3);

    rerender({ items: [{ id: "4", name: "Item 4" }] });

    expect(result.current.selectionCount).toBe(0);
  });

  it("returns selectedItems array", () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem("1");
      result.current.toggleItem("3");
    });

    expect(result.current.selectedItems).toHaveLength(2);
    expect(result.current.selectedItems.map((i) => i.id)).toEqual(["1", "3"]);
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/hooks/use-bulk-selection.test.ts`
Expected: FAIL - hook doesn't exist

### Step 3: Implement the hook

Create `hooks/use-bulk-selection.ts`:

```typescript
/**
 * Hook for managing bulk item selection state.
 * Used for bulk operations like delete in edit mode.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";

interface SelectableItem {
  id: string;
  [key: string]: unknown;
}

interface UseBulkSelectionReturn<T extends SelectableItem> {
  /** Set of selected item IDs */
  selectedIds: Set<string>;
  /** Number of selected items */
  selectionCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Whether some but not all items are selected */
  isPartiallySelected: boolean;
  /** Selected item objects */
  selectedItems: T[];
  /** Toggle selection for a single item */
  toggleItem: (id: string) => void;
  /** Check if an item is selected */
  isSelected: (id: string) => boolean;
  /** Select all items */
  selectAll: () => void;
  /** Deselect all items */
  deselectAll: () => void;
  /** Toggle between all selected and none selected */
  toggleAll: () => void;
}

/**
 * Manages bulk selection state for a list of items.
 * Selection is cleared when items array reference changes.
 *
 * @param items - Array of items with id property
 * @returns Selection state and control functions
 *
 * @example
 * const { selectedIds, toggleItem, selectAll, deselectAll } = useBulkSelection(items);
 *
 * // Check if item is selected
 * const isChecked = isSelected(item.id);
 *
 * // Toggle item on checkbox click
 * <Checkbox checked={isChecked} onCheckedChange={() => toggleItem(item.id)} />
 */
export function useBulkSelection<T extends SelectableItem>(
  items: T[]
): UseBulkSelectionReturn<T> {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when items change (prevents stale selections)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [items]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((item) => item.id)));
  }, [items]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectionCount = selectedIds.size;
  const isAllSelected = selectionCount === items.length && items.length > 0;
  const isPartiallySelected = selectionCount > 0 && !isAllSelected;

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [isAllSelected, selectAll, deselectAll]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  );

  return {
    selectedIds,
    selectionCount,
    isAllSelected,
    isPartiallySelected,
    selectedItems,
    toggleItem,
    isSelected,
    selectAll,
    deselectAll,
    toggleAll,
  };
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/hooks/use-bulk-selection.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add hooks/use-bulk-selection.ts tests/unit/hooks/use-bulk-selection.test.ts
git commit -m "$(cat <<'EOF'
feat(hooks): add useBulkSelection for multi-item selection

Provides selection state management for bulk operations:
- Toggle individual items
- Select/deselect all
- Track partial selection state
- Auto-clear on items change

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create Bulk Actions Toolbar Component

**Files:**

- Create: `components/items/bulk-actions-toolbar.tsx`
- Create: `tests/unit/components/items/bulk-actions-toolbar.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/components/items/bulk-actions-toolbar.test.tsx`:

```typescript
/**
 * Unit tests for BulkActionsToolbar component.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { BulkActionsToolbar } from "@/components/items/bulk-actions-toolbar";

describe("BulkActionsToolbar", () => {
  it("renders selection count", () => {
    render(
      <BulkActionsToolbar
        selectionCount={5}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByText("5 selected")).toBeInTheDocument();
  });

  it("renders select all checkbox", () => {
    render(
      <BulkActionsToolbar
        selectionCount={0}
        isAllSelected={false}
        isPartiallySelected={false}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("shows checkbox as checked when all selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={5}
        isAllSelected={true}
        isPartiallySelected={false}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("shows checkbox as indeterminate when partially selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={2}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "indeterminate");
  });

  it("calls onToggleAll when checkbox clicked", async () => {
    const onToggleAll = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionsToolbar
        selectionCount={0}
        isAllSelected={false}
        isPartiallySelected={false}
        onToggleAll={onToggleAll}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    await user.click(screen.getByRole("checkbox"));

    expect(onToggleAll).toHaveBeenCalled();
  });

  it("renders delete button when items selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={3}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.getByRole("button", { name: /delete 3/i })).toBeInTheDocument();
  });

  it("hides delete button when no items selected", () => {
    render(
      <BulkActionsToolbar
        selectionCount={0}
        isAllSelected={false}
        isPartiallySelected={false}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={false}
      />
    );

    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      <BulkActionsToolbar
        selectionCount={2}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    await user.click(screen.getByRole("button", { name: /delete 2/i }));

    expect(onDelete).toHaveBeenCalled();
  });

  it("shows loading state when deleting", () => {
    render(
      <BulkActionsToolbar
        selectionCount={2}
        isAllSelected={false}
        isPartiallySelected={true}
        onToggleAll={() => {}}
        onDelete={() => {}}
        isDeleting={true}
      />
    );

    expect(screen.getByRole("button", { name: /deleting/i })).toBeDisabled();
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/components/items/bulk-actions-toolbar.test.tsx`
Expected: FAIL - component doesn't exist

### Step 3: Implement the component

Create `components/items/bulk-actions-toolbar.tsx`:

```typescript
/**
 * Toolbar for bulk actions on selected items.
 * Shows selection count and actions like delete.
 */

"use client";

import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface BulkActionsToolbarProps {
  /** Number of selected items */
  selectionCount: number;
  /** Whether all items are selected */
  isAllSelected: boolean;
  /** Whether some but not all items are selected */
  isPartiallySelected: boolean;
  /** Callback to toggle all selection */
  onToggleAll: () => void;
  /** Callback to delete selected items */
  onDelete: () => void;
  /** Whether delete is in progress */
  isDeleting: boolean;
}

/**
 * Toolbar displaying selection state and bulk actions.
 *
 * @example
 * <BulkActionsToolbar
 *   selectionCount={selectedIds.size}
 *   isAllSelected={isAllSelected}
 *   isPartiallySelected={isPartiallySelected}
 *   onToggleAll={toggleAll}
 *   onDelete={handleBulkDelete}
 *   isDeleting={isDeleting}
 * />
 */
export function BulkActionsToolbar({
  selectionCount,
  isAllSelected,
  isPartiallySelected,
  onToggleAll,
  onDelete,
  isDeleting,
}: BulkActionsToolbarProps) {
  return (
    <div className="bg-muted/50 flex items-center gap-4 rounded-lg border px-4 py-2">
      <Checkbox
        checked={isAllSelected ? true : isPartiallySelected ? "indeterminate" : false}
        onCheckedChange={onToggleAll}
        aria-label="Select all items"
      />
      <span className="text-muted-foreground text-sm">
        {selectionCount > 0 ? `${selectionCount} selected` : "Select items"}
      </span>
      {selectionCount > 0 && (
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="ml-auto"
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 size-4" />
              Delete {selectionCount}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/components/items/bulk-actions-toolbar.test.tsx`
Expected: PASS

### Step 5: Commit

```bash
git add components/items/bulk-actions-toolbar.tsx tests/unit/components/items/bulk-actions-toolbar.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): add bulk actions toolbar component

Shows selection count, select-all checkbox, and delete button
for bulk operations on selected items.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create Bulk Delete Server Action

**Files:**

- Modify: `lib/item-actions.ts`
- Modify: `tests/unit/lib/item-actions.test.ts`

### Step 1: Write the failing test

Add to `tests/unit/lib/item-actions.test.ts`:

```typescript
describe("deleteItems (bulk)", () => {
  it("deletes multiple items", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", driveFileId: null },
      { id: "2", userId: "user-1", driveFileId: null },
      { id: "3", userId: "user-1", driveFileId: null },
    ] as any);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 3 });

    const result = await deleteItems(["1", "2", "3"]);

    expect("success" in result && result.success).toBe(true);
    expect("data" in result && result.data?.deleted).toBe(3);
  });

  it("returns error for empty array", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);

    const result = await deleteItems([]);

    expect(result.error).toBe("No items to delete");
  });

  it("returns error when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const result = await deleteItems(["1", "2"]);

    expect(result.error).toBe("Not authenticated");
  });

  it("only deletes items owned by user", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      { id: "1", userId: "user-1", driveFileId: null },
      // Item 2 not returned because it belongs to different user
    ] as any);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 });

    const result = await deleteItems(["1", "2"]);

    expect("success" in result && result.success).toBe(true);
    expect("data" in result && result.data?.deleted).toBe(1);
    expect("data" in result && result.data?.skipped).toBe(1);
  });

  it("handles Drive files deletion", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user-1" } } as any);
    vi.mocked(prisma.item.findMany).mockResolvedValue([
      {
        id: "1",
        userId: "user-1",
        driveFileId: "drive-1",
        driveConnection: { id: "conn-1" },
      },
    ] as any);
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 });

    const result = await deleteItems(["1"]);

    expect("success" in result && result.success).toBe(true);
  });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm test tests/unit/lib/item-actions.test.ts -t "deleteItems"`
Expected: FAIL - function doesn't exist

### Step 3: Implement deleteItems action

Add to `lib/item-actions.ts`:

```typescript
/**
 * Deletes multiple items in bulk.
 * Only deletes items owned by the authenticated user.
 * Children are automatically deleted via Prisma cascade.
 *
 * @param itemIds - Array of item IDs to delete
 * @returns Result with deletion count
 *
 * @example
 * const result = await deleteItems(["item-1", "item-2", "item-3"]);
 * if (result.success) {
 *   console.log(`Deleted ${result.data.deleted} items`);
 * }
 */
export async function deleteItems(
  itemIds: string[]
): Promise<ItemResult<{ deleted: number; skipped: number }>> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Not authenticated" };
  }

  if (itemIds.length === 0) {
    return { error: "No items to delete" };
  }

  try {
    // Find items that belong to this user
    const items = await prisma.item.findMany({
      where: {
        id: { in: itemIds },
        userId: session.user.id,
      },
      include: {
        driveConnection: true,
      },
    });

    const ownedIds = items.map((item) => item.id);
    const skipped = itemIds.length - ownedIds.length;

    if (ownedIds.length === 0) {
      return { error: "No items found to delete" };
    }

    // Collect Drive file IDs for batch deletion
    const driveFileIds = items
      .filter((item) => item.driveFileId)
      .map((item) => item.driveFileId!);

    // Delete from database (cascade handles children)
    const { count } = await prisma.item.deleteMany({
      where: { id: { in: ownedIds } },
    });

    // Log Drive files to delete (actual deletion handled by existing batch mechanism)
    if (driveFileIds.length > 0) {
      logger.info(
        { driveFileIds, count: driveFileIds.length },
        "[BulkDelete] Drive files to delete"
      );
    }

    revalidatePath("/my-items", "layout");

    return {
      success: true,
      data: { deleted: count, skipped },
    };
  } catch (error) {
    logger.error({ err: error }, "[BulkDelete] Delete failed");
    return { error: "Failed to delete items" };
  }
}
```

### Step 4: Run test to verify it passes

Run: `pnpm test tests/unit/lib/item-actions.test.ts -t "deleteItems"`
Expected: PASS

### Step 5: Commit

```bash
git add lib/item-actions.ts tests/unit/lib/item-actions.test.ts
git commit -m "$(cat <<'EOF'
feat(items): add deleteItems bulk delete action

Deletes multiple items in a single database operation.
Only deletes items owned by authenticated user.
Children cascaded via Prisma.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integrate Bulk Selection into ItemsView

**Files:**

- Modify: `components/items/items-view.tsx`
- Modify: `tests/unit/components/items-view.test.tsx`

### Step 1: Add tests for bulk selection

Add to `tests/unit/components/items-view.test.tsx`:

```typescript
describe("bulk selection in edit mode", () => {
  const mockItems = [
    { id: "1", name: "Item 1", order: 0, fileCounts: { media: 0, artwork: 0, subtitles: 0 } },
    { id: "2", name: "Item 2", order: 1, fileCounts: { media: 0, artwork: 0, subtitles: 0 } },
  ] as any;

  it("shows bulk actions toolbar in edit mode", () => {
    render(
      <ItemsView
        items={mockItems}
        parentId={null}
        hasDriveConnection={false}
        isEditing={true}
      />
    );

    expect(screen.getByText("Select items")).toBeInTheDocument();
  });

  it("hides bulk actions toolbar in view mode", () => {
    render(
      <ItemsView
        items={mockItems}
        parentId={null}
        hasDriveConnection={false}
        isEditing={false}
      />
    );

    expect(screen.queryByText("Select items")).not.toBeInTheDocument();
  });

  it("shows delete button when items selected", async () => {
    const user = userEvent.setup();
    render(
      <ItemsView
        items={mockItems}
        parentId={null}
        hasDriveConnection={false}
        isEditing={true}
      />
    );

    // Click the select all checkbox
    await user.click(screen.getByRole("checkbox", { name: /select all/i }));

    expect(screen.getByRole("button", { name: /delete 2/i })).toBeInTheDocument();
  });
});
```

### Step 2: Update ItemsView with bulk selection

In `components/items/items-view.tsx`:

1. Import new components and hooks:

```typescript
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { deleteItems } from "@/lib/item-actions";
```

2. Add bulk selection state:

```typescript
const {
  selectedIds,
  selectionCount,
  isAllSelected,
  isPartiallySelected,
  toggleItem,
  isSelected,
  toggleAll,
  deselectAll,
} = useBulkSelection(displayItems);

const [isDeleting, setIsDeleting] = useState(false);
```

3. Add bulk delete handler:

```typescript
const handleBulkDelete = async () => {
  if (selectionCount === 0) return;

  const confirmed = window.confirm(
    `Delete ${selectionCount} item${selectionCount > 1 ? "s" : ""}? This will also delete all child items and cannot be undone.`
  );

  if (!confirmed) return;

  setIsDeleting(true);
  try {
    const result = await deleteItems(Array.from(selectedIds));
    if ("success" in result && result.success) {
      toast.success(`Deleted ${result.data?.deleted} items`);
      deselectAll();
      // Refetch items via existing getItems action (mocked in tests)
      startTransition(() => {
        getItems(parentId).then((res) => {
          if (res.success && res.data) setItems(res.data);
        });
      });
    } else {
      toast.error(result.error || "Failed to delete items");
    }
  } catch {
    toast.error("Failed to delete items");
  } finally {
    setIsDeleting(false);
  }
};
```

4. Render bulk actions toolbar in edit mode:

```typescript
{isEditing && (
  <BulkActionsToolbar
    selectionCount={selectionCount}
    isAllSelected={isAllSelected}
    isPartiallySelected={isPartiallySelected}
    onToggleAll={toggleAll}
    onDelete={handleBulkDelete}
    isDeleting={isDeleting}
  />
)}
```

5. Pass selection props to tree/grid items (implementation detail for checkboxes in items).

### Step 3: Run tests

Run: `pnpm test tests/unit/components/items-view.test.tsx`
Expected: PASS

### Step 4: Commit

```bash
git add components/items/items-view.tsx tests/unit/components/items-view.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): integrate bulk selection and delete in edit mode

Edit mode now shows:
- Bulk actions toolbar with select all checkbox
- Selection count display
- Delete button for bulk deletion

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Checkboxes to Tree/Grid Items in Edit Mode

**Files:**

- Modify: `components/sortable-tree/components/TreeItem/SortableTreeItem.tsx`
- Modify: `components/sortable-grid/SortableGridItem.tsx`
- Modify: `tests/unit/components/sortable-tree/sortable-tree-item.test.tsx`
- Modify: `tests/unit/components/sortable-grid/sortable-grid-item.test.tsx`

### Step 1: Update TreeItem with checkbox

Add checkbox prop and render in `SortableTreeItem.tsx`:

```typescript
interface SortableTreeItemProps {
  // ... existing props
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

// In render:
{onSelect && (
  <Checkbox
    checked={isSelected}
    onCheckedChange={() => onSelect(id)}
    onClick={(e) => e.stopPropagation()}
    className="mr-2"
  />
)}
```

### Step 2: Update GridItem with checkbox

Similar update for `SortableGridItem.tsx`.

### Step 3: Commit

```bash
git add components/sortable-tree/components/TreeItem/SortableTreeItem.tsx \
        components/sortable-grid/SortableGridItem.tsx \
        tests/unit/components/sortable-tree/sortable-tree-item.test.tsx \
        tests/unit/components/sortable-grid/sortable-grid-item.test.tsx
git commit -m "$(cat <<'EOF'
feat(items): add selection checkboxes to tree and grid items

Checkboxes appear in edit mode when onSelect prop is provided.
Click event stops propagation to prevent item navigation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Add E2E Tests for Bulk Delete

**Files:**

- Create: `e2e/journeys/items/items-bulk-delete.spec.ts`

### Step 1: Create E2E test

```typescript
/**
 * E2E tests for bulk delete functionality.
 */

import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Bulk Delete", () => {
  test.beforeEach(async ({ itemsPage }) => {
    // Create test items
    await itemsPage.goto();
    await itemsPage.createItem("Bulk Test 1");
    await itemsPage.createItem("Bulk Test 2");
    await itemsPage.createItem("Bulk Test 3");
  });

  test("can select and delete multiple items in edit mode", async ({
    itemsPage,
    page,
  }) => {
    // Enter edit mode
    await itemsPage.clickEditButton();

    // Select all items
    await page.getByRole("checkbox", { name: /select all/i }).click();

    // Verify selection count
    await expect(page.getByText("3 selected")).toBeVisible();

    // Click delete button
    await page.getByRole("button", { name: /delete 3/i }).click();

    // Handle confirmation (native confirm dialog mocked in Playwright)
    page.on("dialog", (dialog) => dialog.accept());

    // Verify items are deleted
    await expect(itemsPage.getItemCard("Bulk Test 1")).not.toBeVisible();
    await expect(itemsPage.getItemCard("Bulk Test 2")).not.toBeVisible();
    await expect(itemsPage.getItemCard("Bulk Test 3")).not.toBeVisible();
  });

  test("can select individual items", async ({ itemsPage, page }) => {
    await itemsPage.clickEditButton();

    // Select first item only
    const firstCheckbox = page.getByRole("checkbox").nth(1); // nth(0) is select-all
    await firstCheckbox.click();

    await expect(page.getByText("1 selected")).toBeVisible();
  });

  test("select all checkbox shows indeterminate state", async ({
    itemsPage,
    page,
  }) => {
    await itemsPage.clickEditButton();

    // Select one item
    const firstCheckbox = page.getByRole("checkbox").nth(1);
    await firstCheckbox.click();

    // Select-all should be indeterminate
    const selectAll = page.getByRole("checkbox", { name: /select all/i });
    await expect(selectAll).toHaveAttribute("data-state", "indeterminate");
  });
});
```

### Step 2: Run E2E tests

Run: `pnpm test:e2e e2e/journeys/items/items-bulk-delete.spec.ts`

### Step 3: Commit

```bash
git add e2e/journeys/items/items-bulk-delete.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add bulk delete E2E tests

Tests selection and deletion of multiple items in edit mode.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add E2E Tests for Empty States

**Files:**

- Create: `e2e/journeys/items/items-empty-states.spec.ts`

### Step 1: Create E2E test

```typescript
/**
 * E2E tests for empty state variants.
 */

import { test, expect } from "../../fixtures/auth.fixture";

test.describe("Empty States", () => {
  test("shows first-time empty state for new user", async ({ itemsPage }) => {
    // Clean user with no items
    await itemsPage.goto();

    await expect(itemsPage.page.getByText("No items yet")).toBeVisible();
    await expect(
      itemsPage.page.getByRole("button", { name: /add item/i })
    ).toBeVisible();
  });

  test("shows no-children empty state on empty folder", async ({
    itemsPage,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Empty Folder");
    await itemsPage.openItem("Empty Folder");

    await expect(itemsPage.page.getByText("No child items")).toBeVisible();
  });

  test("shows filter-empty state when filter matches nothing", async ({
    itemsPage,
    page,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Test Item");

    // Apply filter that won't match
    await page.getByRole("button", { name: /all items/i }).click();
    await page.getByText("Sync Error").click();

    await expect(page.getByText("No matching items")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /clear filter/i })
    ).toBeVisible();
  });

  test("clear filter button resets to all items", async ({
    itemsPage,
    page,
  }) => {
    await itemsPage.goto();
    await itemsPage.createItem("Test Item");

    // Apply filter
    await page.getByRole("button", { name: /all items/i }).click();
    await page.getByText("Sync Error").click();

    // Clear filter
    await page.getByRole("button", { name: /clear filter/i }).click();

    // Item should be visible again
    await expect(itemsPage.getItemCard("Test Item")).toBeVisible();
  });
});
```

### Step 2: Run E2E tests

Run: `pnpm test:e2e e2e/journeys/items/items-empty-states.spec.ts`

### Step 3: Commit

```bash
git add e2e/journeys/items/items-empty-states.spec.ts
git commit -m "$(cat <<'EOF'
test(e2e): add empty states E2E tests

Tests contextual empty states for first-time users,
empty folders, and filter results.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Final Verification

### Step 1: Run check script

Run: `pnpm run check`
Expected: All checks pass (format, lint, type-check, knip, build)

### Step 2: Run unit tests

Run: `pnpm test`
Expected: All unit tests pass

### Step 3: Run E2E tests

Run: `pnpm test:e2e`
Expected: All E2E tests pass

### Step 4: Manual testing

1. Verify empty states:
   - New user sees "No items yet"
   - Empty folder shows "No child items"
   - Active filter with no results shows "No matching items"

2. Verify seeding flags:

   ```bash
   ALLOW_SEEDING=true SEED_ONLY_MOVIES=true SEED_MOVIE_COUNT=2 SEED_QUIET=true npx prisma db seed
   ```

3. Verify bulk delete:
   - Enter edit mode
   - Select multiple items with checkboxes
   - Click "Delete N" button
   - Confirm deletion
   - Verify items removed

### Step 5: Final commit

```bash
git add .
git commit -m "$(cat <<'EOF'
docs: add empty states, seeding flags, and bulk ops plan

Implementation plan for:
- Contextual empty states (first-time, no-children, filter-empty)
- Seeding configuration flags (skip drive, movies only, etc.)
- Bulk selection and delete in edit mode

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Testing Summary

### New Tests

| Type | File                                                        | Tests    |
| ---- | ----------------------------------------------------------- | -------- |
| Unit | `tests/unit/components/items/empty-state.test.tsx`          | 6 tests  |
| Unit | `tests/unit/prisma/seed-config.test.ts`                     | 12 tests |
| Unit | `tests/unit/hooks/use-bulk-selection.test.ts`               | 9 tests  |
| Unit | `tests/unit/components/items/bulk-actions-toolbar.test.tsx` | 9 tests  |
| Unit | `tests/unit/lib/item-actions.test.ts` (additions)           | 5 tests  |
| Unit | `tests/unit/components/items-view.test.tsx` (additions)     | 7 tests  |
| E2E  | `e2e/journeys/items/items-bulk-delete.spec.ts`              | 3 tests  |
| E2E  | `e2e/journeys/items/items-empty-states.spec.ts`             | 4 tests  |

### Modified Tests

| File                                        | Changes                                 |
| ------------------------------------------- | --------------------------------------- |
| `tests/unit/components/items-view.test.tsx` | Add empty states + bulk selection tests |

---

## Summary

| Feature         | Files Created                                                                            | Files Modified                                                                      |
| --------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Empty States    | `empty-state.tsx`, `empty-state.test.tsx`, `items-empty-states.spec.ts`                  | `items-view.tsx`, `items-view.test.tsx`                                             |
| Seeding Flags   | `seed-config.test.ts`                                                                    | `seed-config.ts`, `seed.ts`                                                         |
| Bulk Operations | `use-bulk-selection.ts`, `bulk-actions-toolbar.tsx`, `items-bulk-delete.spec.ts` + tests | `item-actions.ts`, `items-view.tsx`, `SortableTreeItem.tsx`, `SortableGridItem.tsx` |

### Key Behaviors

1. **Empty States**: Context-aware messaging with appropriate actions
2. **Seeding Flags**: All new flags default to "disabled" (false/0/null) for backward compatibility
3. **Bulk Operations**: Only available in edit mode, requires confirmation, shows progress
4. **Selection**: Auto-clears when items change, supports select all/partial states
