# Public Pages UI Unification

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify public and private item pages to share components, achieve consistent DOM structure, styling, and behavior.

**Architecture:** Extract shared components (`ItemsSectionHeader`, `ItemsGridView`), refactor public pages to use `EmptyState` component, add toolbar to public pages with sort + fork controls, enforce grid-only view everywhere.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4

---

## Code Review Findings

This plan was validated against **code-review-excellence**, **frontend-design**, **web-design-guidelines**, and **react-best-practices** (45+ rules). The following fixes have been incorporated:

### 🔴 Critical Issues (Fixed in Plan)

1. **localStorage version suffix** (Rule 4.4) - Added `:v1` to storage key
2. **localStorage caching** (Rule 7.5) - Added module-level cache for reads
3. **Duplicate sort functions** (DRY) - Extracted to `lib/item-utils.ts`
4. **Artwork API waterfall** (Rule 1.3) - Start `auth()` early, await late
5. **Link focus-visible styles** (Web Guidelines) - Added ring styles

### 🟡 Important Issues (Fixed in Plan)

1. **Barrel export** (Rule 2.1) - Use direct imports instead
2. **Error message sanitization** - Sanitize fork error messages
3. **Missing `cn` import** - Added to component code

### 🟢 Suggestions (Added to Plan)

1. **Suspense boundaries** (Rule 1.5) - Optional enhancement for faster initial paint
2. **Preload on hover** (Rule 2.5) - Optional enhancement for perceived speed

---

## Audit Summary

### Current State - Inconsistencies Found

| Feature                | Private Pages                                        | Public Pages                                       | Issue                                  |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------- | -------------------------------------- |
| **Empty state**        | Uses `EmptyState` component                          | Hardcoded HTML (120 lines duplicated)              | ❌ Duplication                         |
| **Section header**     | None on detail page                                  | "Contents", "All Collections", "Public Collection" | ❌ Inconsistent                        |
| **Toolbar**            | Full (Sort, Filter, Sync, Edit, View, Add, Settings) | None or partial                                    | ❌ Missing                             |
| **View toggle**        | Tree/Grid on detail pages, Grid-only on root         | Grid only everywhere                               | ⚠️ Need tree/grid on item detail pages |
| **Sort storage**       | Shared localStorage key                              | Shared (causes issues)                             | ❌ Should be separate                  |
| **Username display**   | N/A                                                  | `@username` (not clickable, no "You")              | ❌ Missing features                    |
| **Artwork visibility** | Works for owner                                      | No images for unauthenticated or other users       | ❌ Auth bug                            |

### Bug: Public Item Artwork Not Visible

**Symptoms:**

- When not logged in: Cannot see any images for public items (seeded or non-seeded)
- When logged in as user A: Can only see images from user A's items, not other users' public items

**Root Cause:** The `/api/artwork/[fileId]/route.ts` endpoint likely checks ownership/authentication but doesn't account for public items. For public items, artwork should be viewable by anyone.

**Fix Required:** Update artwork API to allow unauthenticated access when the item is fully public (profile public + item public + all ancestors public).

### Component Usage

| Component      | Private Root | Private Detail | Public Profile | Public Item | Explore      |
| -------------- | ------------ | -------------- | -------------- | ----------- | ------------ |
| `ItemHero`     | ✅           | ✅             | ✅             | ✅          | ✅           |
| `GridItem`     | ✅           | ✅             | ✅             | ✅          | ✅           |
| `EmptyState`   | ✅           | ✅             | ❌ Hardcoded   | ❌ Minimal  | ❌ Hardcoded |
| `SortDropdown` | ✅           | ✅             | ❌ None        | ❌ None     | ✅           |
| `ItemsToolbar` | ✅           | ✅             | ❌ None        | ❌ Custom   | ❌ Custom    |
| Section Header | ❌ None      | ❌ None        | ✅ Custom      | ✅ Custom   | ✅ Custom    |

---

## Implementation Plan

### Phase 1: Extract Shared Components

#### Task 1.1: Create `ItemsSectionHeader` Component

**Files:**

- Create: `components/items/items-section-header.tsx`

**Code:**

```tsx
/**
 * Section header with title and count for items lists.
 * Used on explore, public profile, and public item pages.
 */

import { cn } from "@/lib/utils";

interface ItemsSectionHeaderProps {
  /** Section title (e.g., "Contents", "All Collections") */
  title: string;
  /** Number of items */
  count: number;
  /** Singular label (default: "item") */
  singularLabel?: string;
  /** Plural label (default: "items") */
  pluralLabel?: string;
  /** Additional className */
  className?: string;
}

/**
 * Renders a section header with title and item count.
 */
export function ItemsSectionHeader({
  title,
  count,
  singularLabel = "item",
  pluralLabel = "items",
  className,
}: ItemsSectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <span className="text-muted-foreground text-sm">
        {count} {count === 1 ? singularLabel : pluralLabel}
      </span>
    </div>
  );
}
```

**Step 1:** Create the file with the code above.

**Step 2:** Import directly where needed (avoid barrel exports per Rule 2.1):

```tsx
// ✅ Direct import (preferred - avoids barrel file overhead)
import { ItemsSectionHeader } from "@/components/items/items-section-header";

// ❌ Avoid barrel import
// import { ItemsSectionHeader } from "@/components/items";
```

**Step 3:** Commit:

```bash
git add components/items/items-section-header.tsx
git commit -m "feat(items): add ItemsSectionHeader component"
```

---

#### Task 1.2: Create `PublicEmptyState` Variants

**Files:**

- Modify: `components/items/empty-state.tsx`

**Add new variants for public pages:**

```tsx
export type EmptyStateVariant =
  | "first-time"
  | "no-children"
  | "filter-empty"
  | "search-empty"
  | "public-profile-empty"    // NEW
  | "public-item-empty"       // NEW
  | "explore-empty";          // NEW

// Add to EMPTY_STATE_CONFIG:
"public-profile-empty": {
  icon: Folder,
  title: "No public items yet",
  description: "This user hasn't shared any items publicly. Check back later!",
  actionLabel: "",  // No action for visitors
  actionIcon: Folder,
},
"public-item-empty": {
  icon: FolderOpen,
  title: "No child items",
  description: "This collection doesn't have any child items.",
  actionLabel: "",
  actionIcon: FolderOpen,
},
"explore-empty": {
  icon: Folder,
  title: "Nothing here yet",
  description: "Be the first to share your collection! Make your profile public to have your items featured here.",
  actionLabel: "",
  actionIcon: Folder,
},
```

**Step 1:** Add the new variants to the type and config.

**Step 2:** Update component to only render action button when `onAction` is provided AND `actionLabel` is non-empty:

```tsx
{onAction && config.actionLabel && (
  <Button ...>
```

**Step 3:** Write unit tests for new variants in `tests/unit/components/items/empty-state.test.tsx`:

```tsx
describe("public variants", () => {
  it("renders public-profile-empty without action button", () => {
    render(<EmptyState variant="public-profile-empty" />);
    expect(screen.getByText("No public items yet")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders explore-empty without action button", () => {
    render(<EmptyState variant="explore-empty" />);
    expect(screen.getByText("Nothing here yet")).toBeInTheDocument();
  });

  it("renders public-item-empty without action button", () => {
    render(<EmptyState variant="public-item-empty" />);
    expect(screen.getByText("No child items")).toBeInTheDocument();
  });
});
```

**Step 4:** Commit:

```bash
pnpm run test:unit --grep "EmptyState"
git add components/items/empty-state.tsx tests/unit/components/items/empty-state.test.tsx
git commit -m "feat(items): add public page empty state variants"
```

---

#### Task 1.3: Create `useExploreSortFilter` Hook

**Files:**

- Create: `hooks/use-explore-sort.ts`

**Code:**

```tsx
/**
 * Hook for managing explore page sort state with localStorage persistence.
 * Uses separate storage key from my-items to preserve different defaults.
 * Implements versioned storage (Rule 4.4) and read caching (Rule 7.5).
 */

"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { SortOption } from "@/lib/types";
import { isValidSortOption } from "@/lib/types";

// Versioned storage key (Rule 4.4: Version localStorage data)
const STORAGE_KEY = "canoncore-explore-sort:v1";
const DEFAULT_SORT: SortOption = "updated-desc";

// Module-level cache to avoid repeated localStorage reads (Rule 7.5)
const sortCache = new Map<string, SortOption>();

function getSnapshot(): SortOption {
  // Return cached value if available
  if (sortCache.has(STORAGE_KEY)) {
    return sortCache.get(STORAGE_KEY)!;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Only allow explore-valid sorts (no "custom")
    const value =
      stored && isValidSortOption(stored) && stored !== "custom"
        ? stored
        : DEFAULT_SORT;
    sortCache.set(STORAGE_KEY, value);
    return value;
  } catch {
    return DEFAULT_SORT;
  }
}

function getServerSnapshot(): SortOption {
  return DEFAULT_SORT;
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    // Invalidate cache when storage changes
    if (e.key === STORAGE_KEY || e.key === null) {
      sortCache.delete(STORAGE_KEY);
    }
    callback();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

/**
 * Manages sort state for explore/public pages with localStorage persistence.
 * Defaults to "updated-desc" (Recently Updated).
 * Excludes "custom" sort option (not applicable to public pages).
 */
export function useExploreSortFilter() {
  const sortBy = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const setSortBy = useCallback((sort: SortOption) => {
    if (sort === "custom") return; // Ignore custom sort for explore
    try {
      localStorage.setItem(STORAGE_KEY, sort);
      sortCache.set(STORAGE_KEY, sort); // Keep cache in sync
    } catch {
      // localStorage unavailable (incognito, quota exceeded)
    }
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return { sortBy, setSortBy };
}
```

**Step 1:** Create the hook file.

**Step 2:** Write unit tests in `tests/unit/hooks/use-explore-sort.test.ts`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";

const STORAGE_KEY = "canoncore-explore-sort:v1"; // Versioned key

describe("useExploreSortFilter", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to updated-desc", () => {
    const { result } = renderHook(() => useExploreSortFilter());
    expect(result.current.sortBy).toBe("updated-desc");
  });

  it("persists sort preference with versioned key", () => {
    const { result } = renderHook(() => useExploreSortFilter());
    act(() => result.current.setSortBy("name-asc"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("name-asc");
  });

  it("ignores custom sort option", () => {
    const { result } = renderHook(() => useExploreSortFilter());
    act(() => result.current.setSortBy("custom"));
    expect(result.current.sortBy).toBe("updated-desc");
  });

  it("restores valid sort from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "name-desc");
    const { result } = renderHook(() => useExploreSortFilter());
    expect(result.current.sortBy).toBe("name-desc");
  });

  it("uses default if localStorage has invalid value", () => {
    localStorage.setItem(STORAGE_KEY, "custom");
    const { result } = renderHook(() => useExploreSortFilter());
    expect(result.current.sortBy).toBe("updated-desc");
  });

  it("caches localStorage reads (performance)", () => {
    localStorage.setItem(STORAGE_KEY, "name-asc");
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");

    const { result, rerender } = renderHook(() => useExploreSortFilter());
    expect(result.current.sortBy).toBe("name-asc");

    // Re-render multiple times
    rerender();
    rerender();
    rerender();

    // Should only read localStorage once due to caching
    expect(getItemSpy).toHaveBeenCalledTimes(1);
    getItemSpy.mockRestore();
  });

  it("invalidates cache on storage event", () => {
    localStorage.setItem(STORAGE_KEY, "name-asc");
    const { result } = renderHook(() => useExploreSortFilter());
    expect(result.current.sortBy).toBe("name-asc");

    // Simulate external storage change
    localStorage.setItem(STORAGE_KEY, "name-desc");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    });

    expect(result.current.sortBy).toBe("name-desc");
  });
});
```

**Step 3:** Commit:

```bash
pnpm run test:unit --grep "useExploreSortFilter"
git add hooks/use-explore-sort.ts tests/unit/hooks/use-explore-sort.test.ts
git commit -m "feat(hooks): add useExploreSortFilter with separate storage"
```

---

#### Task 1.4: Add `descriptionHref` Prop to `GridItem`

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`

**Step 1:** Add prop to interface:

```tsx
export interface GridItemProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "id"
> {
  // ... existing props
  /** Optional URL to make description a clickable link. */
  descriptionHref?: string;
}
```

**Step 2:** Update description rendering (around line 267):

```tsx
{
  /* Description */
}
{
  shouldShowDescription &&
    (descriptionHref ? (
      <Link
        href={descriptionHref}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 line-clamp-2 rounded text-sm text-white/80 drop-shadow-sm hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50 focus-visible:outline-none"
      >
        {description}
      </Link>
    ) : (
      <p className="mt-1 line-clamp-2 text-sm text-white/80 drop-shadow-sm">
        {description}
      </p>
    ));
}
```

> **Note:** Added `focus-visible:ring-*` classes per Web Interface Guidelines - interactive elements need visible focus states.

**Step 3:** Add Link import at top:

```tsx
import Link from "next/link";
```

**Step 4:** Write unit tests:

```tsx
describe("descriptionHref prop", () => {
  it("renders description as link when href provided", () => {
    render(
      <GridItem
        id="1"
        name="Test"
        description="@user"
        descriptionHref="/u/user"
      />
    );
    const link = screen.getByRole("link", { name: "@user" });
    expect(link).toHaveAttribute("href", "/u/user");
  });

  it("renders description as text when no href", () => {
    render(<GridItem id="1" name="Test" description="Some text" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Some text")).toBeInTheDocument();
  });

  it("stops click propagation on link click", async () => {
    const onClick = vi.fn();
    render(
      <GridItem
        id="1"
        name="Test"
        description="@user"
        descriptionHref="/u/user"
        onClick={onClick}
      />
    );
    await userEvent.click(screen.getByRole("link"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

**Step 5:** Commit:

```bash
pnpm run test:unit --grep "GridItem"
git add components/sortable-grid/GridItem.tsx tests/unit/components/sortable-grid/
git commit -m "feat(GridItem): add descriptionHref prop for clickable descriptions"
```

---

#### Task 1.5: Add `hideViewToggle` and `forceGridView` Props

**Files:**

- Modify: `components/items/items-toolbar.tsx`
- Modify: `components/items/items-view.tsx`

**Step 1:** In `items-toolbar.tsx`, add prop:

```tsx
interface ItemsToolbarProps {
  // ... existing
  /** Hide the view toggle (for grid-only pages). */
  hideViewToggle?: boolean;
}
```

Update render:

```tsx
{
  /* View toggle - hidden when hideViewToggle=true */
}
{
  !hideViewToggle && <ViewToggle disabled={!hasItems} />;
}
```

**Step 2:** In `items-view.tsx`, add prop:

```tsx
interface ItemsViewProps {
  // ... existing
  /** Force grid view regardless of stored preference. */
  forceGridView?: boolean;
}
```

Update view mode logic:

```tsx
const [storedViewMode] = useStoredViewMode();
const viewMode = forceGridView ? "grid" : storedViewMode;
```

Update internal toolbar to hide ViewToggle when forceGridView:

```tsx
{
  !forceGridView && <ViewToggle disabled={items.length === 0} />;
}
```

**Step 3:** Write unit tests for both components.

**Step 4:** Commit:

```bash
pnpm run test:unit --grep "ItemsToolbar\|ItemsView"
git add components/items/items-toolbar.tsx components/items/items-view.tsx tests/unit/components/items/
git commit -m "feat(items): add hideViewToggle and forceGridView props"
```

---

#### Task 1.6: Extract Shared `sortPublicItems` Function (DRY)

> **Code Review Note:** The sort function was duplicated across 3 client components. Extracted to shared utility per DRY principle.

**Files:**

- Modify: `lib/item-utils.ts`

**Step 1:** Add the shared sort function to `lib/item-utils.ts`:

```tsx
/**
 * Sort items for public/explore pages.
 * Uses toSorted() for immutability (Rule 7.12).
 *
 * @param items - Array of items with name and updatedAt fields
 * @param sortBy - Sort option
 * @returns New sorted array (original unchanged)
 */
export function sortPublicItems<
  T extends { name: string; updatedAt: Date | string },
>(items: T[], sortBy: SortOption): T[] {
  return items.toSorted((a, b) => {
    switch (sortBy) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "created-desc":
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      case "created-asc":
        return (
          new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        );
      case "updated-desc":
      default:
        return (
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
    }
  });
}
```

**Step 2:** Write unit tests in `tests/unit/lib/item-utils.test.ts`:

```tsx
describe("sortPublicItems", () => {
  const items = [
    { name: "Banana", updatedAt: new Date("2024-01-01") },
    { name: "Apple", updatedAt: new Date("2024-01-03") },
    { name: "Cherry", updatedAt: new Date("2024-01-02") },
  ];

  it("sorts by name ascending", () => {
    const result = sortPublicItems(items, "name-asc");
    expect(result.map((i) => i.name)).toEqual(["Apple", "Banana", "Cherry"]);
  });

  it("sorts by name descending", () => {
    const result = sortPublicItems(items, "name-desc");
    expect(result.map((i) => i.name)).toEqual(["Cherry", "Banana", "Apple"]);
  });

  it("sorts by updated-desc (default)", () => {
    const result = sortPublicItems(items, "updated-desc");
    expect(result.map((i) => i.name)).toEqual(["Apple", "Cherry", "Banana"]);
  });

  it("does not mutate original array (immutability)", () => {
    const original = [...items];
    sortPublicItems(items, "name-asc");
    expect(items).toEqual(original);
  });
});
```

**Step 3:** Commit:

```bash
pnpm run test:unit --grep "sortPublicItems"
git add lib/item-utils.ts tests/unit/lib/item-utils.test.ts
git commit -m "feat(utils): extract sortPublicItems for public pages (DRY)"
```

---

### Phase 2: Enforce Grid-Only on Root Listing Pages

#### Task 2.1: Update My Items Root Page for Grid-Only

**Files:**

- Modify: `app/(my-items)/my-items/page.tsx` or the client component

**Step 1:** Pass `forceGridView` and `hideViewToggle` to enforce grid on root items view:

```tsx
<ItemsView
  items={rootItems}
  forceGridView
  hideViewToggle
  // ... other props
/>
```

**Step 2:** Commit:

```bash
pnpm run type-check
git add app/(my-items)/my-items/
git commit -m "fix(items): enforce grid-only view on my-items root page"
```

> **Note:** Private item detail pages (`/my-items/[itemId]`) should keep both tree and grid view options - do NOT add `forceGridView` there.

---

### Phase 3: Refactor Explore Page

#### Task 3.1: Rewrite `ExploreClient` Using Shared Components

**Files:**

- Modify: `app/(public)/explore/page.tsx`
- Modify: `app/(public)/explore/explore-client.tsx`

**Step 1:** Update `page.tsx` with Suspense boundary (Rule 1.5 - faster initial paint):

> **Note:** If `GridSkeleton` doesn't exist, create a simple skeleton component:
>
> ```tsx
> // components/items/grid-skeleton.tsx
> export function GridSkeleton() {
>   return (
>     <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
>       {Array.from({ length: 8 }).map((_, i) => (
>         <div
>           key={i}
>           className="bg-muted aspect-[2/3] animate-pulse rounded-lg"
>         />
>       ))}
>     </div>
>   );
> }
> ```

```tsx
import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { getExploreItems } from "@/lib/public-auth";
import { SiteHeader } from "@/components/site-header";
import { ExploreClient } from "./explore-client";
import { GridSkeleton } from "@/components/items/grid-skeleton";

export default function ExplorePage() {
  return (
    <>
      <SiteHeader title="Explore" titleHref="/explore" />
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <Suspense fallback={<GridSkeleton />}>
          <ExploreContent />
        </Suspense>
      </div>
    </>
  );
}

// Async component inside Suspense (Rule 1.5)
async function ExploreContent() {
  const [items, session] = await Promise.all([getExploreItems(50, 0), auth()]);

  return (
    <ExploreClient items={items} currentUserId={session?.user?.id ?? null} />
  );
}
```

**Step 2:** Rewrite `explore-client.tsx`:

```tsx
"use client";

/**
 * Client component for the explore page.
 * Uses unified components: ItemHero, SortDropdown, GridItem, EmptyState.
 * Uses shared sortPublicItems utility (DRY).
 */

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import {
  EXPLORE_SORT_OPTIONS,
  EXPLORE_FILTER_OPTIONS,
  sortPublicItems, // Shared utility (Task 1.6)
} from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { PublicItem } from "@/lib/public-auth";

interface ExploreClientProps {
  items: (PublicItem & { ownerUsername: string })[];
  currentUserId: string | null;
}

export function ExploreClient({ items, currentUserId }: ExploreClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();

  // Use shared sort utility (DRY - no duplicate sort function)
  const sortedItems = useMemo(
    () => sortPublicItems(items, sortBy),
    [items, sortBy]
  );

  // Preload on hover for faster perceived navigation (Rule 2.5)
  const handleMouseEnter = useCallback(
    (item: PublicItem & { ownerUsername: string }) => {
      router.prefetch(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const handleItemClick = useCallback(
    (item: PublicItem & { ownerUsername: string }) => {
      router.push(`/u/${item.ownerUsername}/${item.id}`);
    },
    [router]
  );

  const hasItems = items.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Hero banner */}
      <ItemHero
        name="Explore Collections"
        description="Discover curated media libraries from the community. Fork collections to build your own."
      />

      {/* Toolbar - Sort only (no filter, no view toggle) */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: Options sheet (sort only) */}
          <div className="sm:hidden">
            <MobileOptionsSheet
              sortBy={sortBy}
              onSortChange={setSortBy}
              disabled={!hasItems}
              sortOptions={EXPLORE_SORT_OPTIONS}
              filterOptions={EXPLORE_FILTER_OPTIONS}
              defaultSort="updated-desc"
            />
          </div>

          {/* Desktop: Sort dropdown */}
          <div className="hidden items-center gap-3 sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasItems}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>
        </div>

        {/* Right side: Empty (no actions for explore) */}
        <div />
      </div>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {sortedItems.map((item, index) => {
            const isOwnItem = currentUserId === item.userId;
            return (
              <GridItem
                key={item.id}
                id={item.id}
                name={item.name}
                description={isOwnItem ? "You" : `@${item.ownerUsername}`}
                descriptionHref={
                  isOwnItem ? undefined : `/u/${item.ownerUsername}`
                }
                artworkId={item.artworkId}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => handleMouseEnter(item)}
                showArtwork={true}
                showDescription={true}
                priority={index < 8}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState variant="explore-empty" />
      )}
    </div>
  );
}
```

**Step 3:** Update E2E test - remove "shows collection count" test:

```typescript
// DELETE from e2e/journeys/public/explore.spec.ts:
test("shows collection count", async ({ page, publicProfilePage }) => {
  // ...
});
```

**Step 4:** Commit:

```bash
pnpm run type-check && pnpm run test:e2e --grep "Explore"
git add app/(public)/explore/
git commit -m "refactor(explore): use shared components, add 'You' label, clickable usernames"
```

---

### Phase 4: Refactor Public Profile Page

#### Task 4.1: Rewrite `PublicProfileClient` Using Shared Components

**Files:**

- Modify: `app/(public)/u/[username]/page.tsx`
- Modify: `app/(public)/u/[username]/public-profile-client.tsx`

**Step 1:** Update `page.tsx` to pass `currentUserId`:

```tsx
import { auth } from "@/lib/auth";

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;

  // Rate limit and fetch in parallel
  const [rateLimitResult, profile, session] = await Promise.all([
    checkRateLimit("publicProfile"),
    getPublicProfile(username),
    auth(),
  ]);

  if (rateLimitResult) {
    return <div>...</div>;
  }

  if (!profile) {
    notFound();
  }

  const items = await getPublicItemsForUser(profile.id, 50, 0);

  return (
    <>
      <SiteHeader ... />
      <div className="...">
        <PublicProfileClient
          profile={profile}
          items={items}
          currentUserId={session?.user?.id ?? null}
        />
      </div>
    </>
  );
}
```

**Step 2:** Rewrite `public-profile-client.tsx`:

```tsx
"use client";

/**
 * Client component for public profile page.
 * Uses unified components: ItemHero, SortDropdown, GridItem, EmptyState.
 * Uses shared sortPublicItems utility (DRY).
 */

import { useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import {
  EXPLORE_SORT_OPTIONS,
  EXPLORE_FILTER_OPTIONS,
  sortPublicItems, // Shared utility (Task 1.6)
} from "@/lib/item-utils";
import { cn } from "@/lib/utils";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";

interface PublicProfileClientProps {
  profile: PublicProfile;
  items: PublicItem[];
  currentUserId: string | null;
}

export function PublicProfileClient({
  profile,
  items,
  currentUserId,
}: PublicProfileClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();
  const displayName = profile.name ?? `@${profile.username}`;
  const isOwnProfile = currentUserId === profile.id;

  // Use shared sort utility (DRY - no duplicate sort function)
  const sortedItems = useMemo(
    () => sortPublicItems(items, sortBy),
    [items, sortBy]
  );

  // Preload on hover for faster perceived navigation (Rule 2.5)
  const handleMouseEnter = useCallback(
    (id: string) => {
      router.prefetch(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const handleItemClick = useCallback(
    (id: string) => {
      router.push(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const heroBackgroundUrl = profile.hasHeroImage
    ? `/api/user/hero?userId=${profile.id}`
    : undefined;

  const hasItems = items.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasItems && "flex-1")}>
      {/* Hero banner */}
      <ItemHero
        name={displayName}
        description={
          isOwnProfile ? "Your public profile" : `@${profile.username}`
        }
        backgroundUrl={heroBackgroundUrl}
      />

      {/* Toolbar - Sort only */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile: Options sheet */}
          <div className="sm:hidden">
            <MobileOptionsSheet
              sortBy={sortBy}
              onSortChange={setSortBy}
              disabled={!hasItems}
              sortOptions={EXPLORE_SORT_OPTIONS}
              filterOptions={EXPLORE_FILTER_OPTIONS}
              defaultSort="updated-desc"
            />
          </div>

          {/* Desktop: Sort dropdown */}
          <div className="hidden items-center gap-3 sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasItems}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>
        </div>

        <div />
      </div>

      {/* Items grid or empty state */}
      {hasItems ? (
        <div
          data-testid="items-grid-view"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {sortedItems.map((item, index) => (
            <GridItem
              key={item.id}
              id={item.id}
              name={item.name}
              description={item.description}
              artworkId={item.artworkId}
              onClick={() => handleItemClick(item.id)}
              onMouseEnter={() => handleMouseEnter(item.id)}
              showArtwork={true}
              showDescription={true}
              priority={index < 8}
            />
          ))}
        </div>
      ) : (
        <EmptyState variant="public-profile-empty" />
      )}
    </div>
  );
}
```

**Step 3:** Commit:

```bash
pnpm run type-check
git add app/(public)/u/[username]/page.tsx app/(public)/u/[username]/public-profile-client.tsx
git commit -m "refactor(public-profile): use shared components, add sort dropdown"
```

---

### Phase 5: Refactor Public Item Page

#### Task 5.1: Rewrite `PublicItemClient` with Toolbar

**Files:**

- Modify: `app/(public)/u/[username]/[itemId]/public-item-client.tsx`

**Rewrite to include proper toolbar with sort + fork + view toggle (tree/grid):**

```tsx
"use client";

/**
 * Client component for public item detail page.
 * Uses unified components: ItemHero, SortDropdown, GridItem, EmptyState.
 * Uses shared sortPublicItems utility (DRY).
 * Includes fork functionality and view toggle (tree/grid) in toolbar.
 */

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ItemHero } from "@/components/items/item-hero";
import { GridItem } from "@/components/sortable-grid/GridItem";
import { Tree } from "@/components/sortable-tree/Tree";
import { SortDropdown } from "@/components/items/sort-dropdown";
import { ViewToggle } from "@/components/items/view-toggle";
import { MobileOptionsSheet } from "@/components/items/mobile-options-sheet";
import { EmptyState } from "@/components/items/empty-state";
import { useExploreSortFilter } from "@/hooks/use-explore-sort";
import { useViewMode } from "@/hooks/use-view-mode"; // For tree/grid toggle
import {
  EXPLORE_SORT_OPTIONS,
  EXPLORE_FILTER_OPTIONS,
  sortPublicItems, // Shared utility (Task 1.6)
  flatToTree, // For tree view conversion
} from "@/lib/item-utils";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { PublicProfile, PublicItem } from "@/lib/public-auth";
import type { ForkInfo, ForkStatus } from "@/lib/fork-actions";
import type { ViewMode } from "@/lib/types";

interface PublicItemClientProps {
  profile: PublicProfile;
  item: PublicItem;
  childItems: PublicItem[];
  forkInfo: ForkInfo | null;
  forkStatus: ForkStatus | null;
  isAuthenticated: boolean;
  isOwnItem: boolean;
}

// Safe error messages to expose to users (sanitization)
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  "Cannot fork your own item": "Cannot fork your own item",
  "Already forked": "This item is already in your library",
  "Item not found": "This item could not be found",
  "Rate limit exceeded": "Too many requests. Please try again later.",
};

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return SAFE_ERROR_MESSAGES[error.message] ?? "Failed to fork item";
  }
  return "Failed to fork item";
}

export function PublicItemClient({
  profile,
  item,
  childItems,
  forkInfo,
  forkStatus,
  isAuthenticated,
  isOwnItem,
}: PublicItemClientProps) {
  const router = useRouter();
  const { sortBy, setSortBy } = useExploreSortFilter();
  const [viewMode, setViewMode] = useViewMode(); // Tree/Grid toggle
  const [isForking, setIsForking] = useState(false);

  // Use shared sort utility (DRY - no duplicate sort function)
  const sortedChildItems = useMemo(
    () => sortPublicItems(childItems, sortBy),
    [childItems, sortBy]
  );

  // Convert to tree structure for tree view
  const treeItems = useMemo(
    () => flatToTree(sortedChildItems),
    [sortedChildItems]
  );

  // Focus management for accessibility when switching views
  const contentRef = useRef<HTMLDivElement>(null);
  const previousViewMode = useRef(viewMode);

  useEffect(() => {
    // Only manage focus when view mode actually changes (not on mount)
    if (previousViewMode.current !== viewMode && contentRef.current) {
      // Move focus to content area for screen reader users
      contentRef.current.focus();
    }
    previousViewMode.current = viewMode;
  }, [viewMode]);

  // Preload on hover for faster perceived navigation (Rule 2.5)
  const handleMouseEnter = useCallback(
    (id: string) => {
      router.prefetch(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const handleFork = async () => {
    setIsForking(true);
    try {
      const response = await fetch(`/api/fork/${item.id}`, { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to fork item");
      }

      toast.success("Added to your library!", {
        description: `${item.name} has been forked to your library.`,
        action: {
          label: "View",
          onClick: () => router.push(`/my-items/${data.itemId}`),
        },
      });

      router.refresh();
    } catch (error) {
      // Sanitize error message to avoid leaking internal details
      toast.error(getSafeErrorMessage(error));
    } finally {
      setIsForking(false);
    }
  };

  const handleItemClick = useCallback(
    (id: string) => {
      router.push(`/u/${profile.username}/${id}`);
    },
    [router, profile.username]
  );

  const hasChildren = childItems.length > 0;

  return (
    <div className={cn("flex flex-col gap-6", !hasChildren && "flex-1")}>
      {/* Hero banner */}
      <ItemHero
        name={item.name}
        description={item.description}
        artworkId={item.artworkId}
      />

      {/* Toolbar - Sort + View Toggle + Fork */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        {/* Left side: Sort + View Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="sm:hidden">
            <MobileOptionsSheet
              sortBy={sortBy}
              onSortChange={setSortBy}
              disabled={!hasChildren}
              sortOptions={EXPLORE_SORT_OPTIONS}
              filterOptions={EXPLORE_FILTER_OPTIONS}
              defaultSort="updated-desc"
            />
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <SortDropdown
              value={sortBy}
              onChange={setSortBy}
              disabled={!hasChildren}
              options={EXPLORE_SORT_OPTIONS}
            />
          </div>

          {/* View Toggle - Tree/Grid (available on detail pages) */}
          <ViewToggle
            value={viewMode}
            onChange={setViewMode}
            disabled={!hasChildren}
          />
        </div>

        {/* Right side: Fork info + button */}
        <div className="flex items-center gap-3">
          {/* Fork count */}
          {forkInfo && forkInfo.forkCount > 0 && (
            <span className="text-muted-foreground hidden items-center gap-1.5 text-sm sm:flex">
              <Copy className="size-4" />
              {forkInfo.forkCount} {forkInfo.forkCount === 1 ? "fork" : "forks"}
            </span>
          )}

          {/* Fork button - only show for non-owners */}
          {!isOwnItem &&
            (forkStatus?.hasForked ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/my-items/${forkStatus.forkedItemId}`}>
                  <Check className="mr-2 size-4 text-green-500" />
                  <span className="hidden sm:inline">In Your Library</span>
                  <span className="sm:hidden">Library</span>
                </Link>
              </Button>
            ) : isAuthenticated ? (
              <Button onClick={handleFork} disabled={isForking} size="sm">
                {isForking ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                <span className="hidden sm:inline">Fork to Library</span>
                <span className="sm:hidden">Fork</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <Link href="/sign-in">
                  <Copy className="mr-2 size-4" />
                  <span className="hidden sm:inline">Sign in to Fork</span>
                  <span className="sm:hidden">Sign in</span>
                </Link>
              </Button>
            ))}
        </div>
      </div>

      {/* Forked from attribution */}
      {forkInfo?.source && (
        <p className="text-muted-foreground text-sm">
          Forked from{" "}
          <Link
            href={`/u/${forkInfo.source.ownerUsername}/${forkInfo.source.id}`}
            className="hover:text-foreground underline"
          >
            {forkInfo.source.name}
          </Link>
          {forkInfo.source.ownerUsername && (
            <>
              {" "}
              by{" "}
              <Link
                href={`/u/${forkInfo.source.ownerUsername}`}
                className="hover:text-foreground underline"
              >
                @{forkInfo.source.ownerUsername}
              </Link>
            </>
          )}
        </p>
      )}

      {/* Child items - Tree or Grid view based on user preference */}
      {/* Content container with focus management for accessibility */}
      <div
        ref={contentRef}
        tabIndex={-1}
        aria-label={`Items displayed in ${viewMode} view`}
        className="outline-none"
      >
        {hasChildren ? (
          viewMode === "tree" ? (
            // Tree view for hierarchical navigation
            // NOTE: Verify Tree component prop names - may be onSelect instead of onItemClick
            <Tree
              items={treeItems}
              onItemClick={handleItemClick}
              onItemHover={handleMouseEnter} // Preload on hover (same as grid)
              readOnly
            />
          ) : (
            // Grid view for visual browsing
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
      </div>
    </div>
  );
}
```

**Step 2:** Commit:

```bash
pnpm run type-check
git add app/(public)/u/[username]/[itemId]/public-item-client.tsx
git commit -m "refactor(public-item): use shared components, add sort dropdown to toolbar"
```

---

### Phase 6: Fix Public Artwork Visibility

#### Task 6.1: Update Artwork API for Public Access

**Files:**

- Modify: `app/api/artwork/[fileId]/route.ts`

**Step 1:** Read current implementation to understand auth check.

**Step 2:** Update to allow public access (with waterfall fix - Rule 1.3):

```tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isItemFullyPublic } from "@/lib/public-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  // Start auth() early - we might need it (Rule 1.3: Prevent Waterfall Chains)
  // This runs in parallel with the database query
  const sessionPromise = auth();

  // Find the ItemFile and its associated Item
  const itemFile = await prisma.itemFile.findUnique({
    where: { driveFileId: fileId },
    select: {
      id: true,
      driveFileId: true,
      item: {
        select: {
          id: true,
          userId: true,
          isPublic: true,
          inheritVisibility: true,
          parentId: true,
        },
      },
    },
  });

  if (!itemFile) {
    return new Response("Not found", { status: 404 });
  }

  // Check if item is fully public (no auth required)
  const isPublic = await isItemFullyPublic(itemFile.item.id);

  if (!isPublic) {
    // Private item - require auth and ownership
    // Session was already started, so this await is fast
    const session = await sessionPromise;
    if (!session?.user?.id || session.user.id !== itemFile.item.userId) {
      return new Response("Unauthorized", { status: 401 });
    }
  }
  // Public item - allow access without auth, continue to stream...

  // Stream artwork from Google Drive...
}
```

**Step 3:** Also update `/api/stream/[fileId]/route.ts` with same logic (for media playback on public items).

**Step 4:** Write unit tests for public artwork access.

**Step 5:** Commit:

```bash
pnpm run test:unit --grep "artwork"
git add app/api/artwork/ app/api/stream/ tests/unit/api/
git commit -m "fix(api): allow public access to artwork for public items"
```

---

### Phase 7: Final Verification

#### Task 7.1: Run All Tests

```bash
pnpm run check
pnpm run test
pnpm run test:e2e
```

#### Task 7.2: Manual Verification Checklist

- [ ] **Explore page**
  - [ ] No "All Collections" header
  - [ ] Sort dropdown with "Recently Updated" default
  - [ ] Own items show "You" (not clickable)
  - [ ] Other items show "@username" (clickable to profile)
  - [ ] Empty state uses `EmptyState` component
  - [ ] **Grid only** (no view toggle)

- [ ] **Public profile page**
  - [ ] Sort dropdown with "Recently Updated" default
  - [ ] Own profile shows "Your public profile" in hero
  - [ ] Empty state uses `EmptyState` component
  - [ ] **Grid only** (no view toggle)

- [ ] **Public item detail page**
  - [ ] Sort dropdown in toolbar
  - [ ] **View toggle (tree/grid)** in toolbar
  - [ ] Fork button in toolbar (right side)
  - [ ] Fork count displays
  - [ ] "Forked from" attribution below toolbar
  - [ ] Empty state uses `EmptyState` component
  - [ ] Tree view shows hierarchical structure
  - [ ] Grid view shows poster cards

- [ ] **My Items root page**
  - [ ] **Grid only** (no view toggle)
  - [ ] All other toolbar features work (Add, Edit, Sync, Settings)

- [ ] **Private item detail page**
  - [ ] **View toggle (tree/grid)** works
  - [ ] All other toolbar features work (Add, Edit, Sync, Settings)

- [ ] **Sidebar pinned items**
  - [ ] Show on all pages (already fixed in previous task)

- [ ] **Artwork visibility (when logged out)**
  - [ ] Explore page shows artwork for all public items
  - [ ] Public profile pages show user's artwork
  - [ ] Public item pages show item artwork and child artwork

- [ ] **Artwork visibility (when logged in as different user)**
  - [ ] Explore page shows artwork for all items (including other users')
  - [ ] Other users' public profiles show their artwork
  - [ ] Other users' public items show artwork

---

## Test Updates Summary

| Test File                                               | Action                               | Reason                                    |
| ------------------------------------------------------- | ------------------------------------ | ----------------------------------------- |
| `e2e/journeys/public/explore.spec.ts`                   | Remove "shows collection count" test | Header removed                            |
| `tests/unit/hooks/use-explore-sort.test.ts`             | Create                               | New hook with versioned storage + caching |
| `tests/unit/lib/item-utils.test.ts`                     | Add sortPublicItems tests            | Shared sort utility (Task 1.6)            |
| `tests/unit/components/items/empty-state.test.tsx`      | Add public variant tests             | New variants                              |
| `tests/unit/components/items/items-toolbar.test.tsx`    | Add hideViewToggle tests             | New prop                                  |
| `tests/unit/components/sortable-grid/GridItem.test.tsx` | Add descriptionHref + focus tests    | New prop + accessibility                  |
| `tests/unit/api/artwork.test.ts`                        | Add public access tests              | Public artwork visibility                 |
| `tests/unit/api/stream.test.ts`                         | Add public access tests              | Public media visibility                   |

---

## Summary of Changes

| Page/Component          | Before                                                  | After                                                                                                                                  |
| ----------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Explore**             | Custom empty state, shared sort storage, no "You" label | `EmptyState`, separate versioned storage, "You" for own items, clickable usernames, Suspense boundary, preload on hover, **grid only** |
| **Public Profile**      | Custom empty state, no toolbar                          | `EmptyState`, sort toolbar, preload on hover, **grid only**                                                                            |
| **Public Item Detail**  | Custom ForkActionBar, no sort, grid only                | Unified toolbar with sort + **view toggle (tree/grid)** + fork, sanitized error messages, preload on hover                             |
| **My Items Root**       | Tree/Grid toggle                                        | **Grid only** (enforced)                                                                                                               |
| **Private Item Detail** | Tree/Grid toggle                                        | Tree/Grid toggle (unchanged - keeps user choice)                                                                                       |
| **All public pages**    | Duplicated sort functions (~60 lines × 3)               | Shared `sortPublicItems` utility using `toSorted()`                                                                                    |
| **localStorage hook**   | Unversioned key, no caching                             | Versioned key (`:v1`), module-level cache, cache invalidation on storage events                                                        |
| **GridItem Link**       | No focus styles                                         | `focus-visible:ring-*` styles for accessibility                                                                                        |
| **Artwork API**         | Auth required (blocks public access), waterfall         | Public items accessible without auth, parallel `auth()` start                                                                          |
| **Stream API**          | Auth required (blocks public access)                    | Public items accessible without auth                                                                                                   |

### Code Quality Improvements Applied

| Category            | Issue                              | Fix                                                |
| ------------------- | ---------------------------------- | -------------------------------------------------- |
| **Performance**     | localStorage read on every render  | Module-level cache (Rule 7.5)                      |
| **Performance**     | Sequential API awaits              | Start auth() early, await late (Rule 1.3)          |
| **Performance**     | No preloading                      | Prefetch on hover (Rule 2.5)                       |
| **Performance**     | No Suspense boundaries             | Added Suspense for faster initial paint (Rule 1.5) |
| **Performance**     | Tree view no preload               | Added `onItemHover` for Tree preloading            |
| **Maintainability** | Duplicate sort functions           | Extracted to `lib/item-utils.ts` (DRY)             |
| **Maintainability** | Barrel exports                     | Use direct imports (Rule 2.1)                      |
| **Immutability**    | `sort()` mutates                   | `toSorted()` for immutability (Rule 7.12)          |
| **Security**        | Raw error messages exposed         | Sanitized via allowlist mapping                    |
| **Accessibility**   | Link missing focus styles          | Added `focus-visible:ring-*`                       |
| **Accessibility**   | No focus management on view switch | Added ref + useEffect to focus content area        |
| **Accessibility**   | No view mode announcement          | Added `aria-label` with current view mode          |
| **Robustness**      | Unversioned localStorage           | Added version suffix for migrations                |
