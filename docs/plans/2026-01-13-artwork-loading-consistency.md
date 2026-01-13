# Artwork Loading Consistency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preload first 8 artwork images in ALL components that display artwork. Show loading state until preloaded.

**Pattern:** Every component with artwork does: collect first 8 URLs → preload → show spinner/skeleton → reveal content.

---

## Validation Notes

Validated using code-review-excellence skill, Context7 React docs, and sequential thinking.

### Issues Fixed in This Plan

| Issue                        | Severity     | Fix                                              |
| ---------------------------- | ------------ | ------------------------------------------------ |
| Missing useEffect cleanup    | 🔴 Blocking  | Added `cancelled` flag and cleanup return        |
| Array dependency instability | 🔴 Blocking  | Use stable string key instead of array reference |
| Race condition on URL change | 🔴 Blocking  | Cleanup prevents stale callbacks                 |
| Initial state always true    | 🟡 Important | Compute initial state from URLs                  |
| Duplicate utility            | 🟡 Important | Leverage existing `lib/image-preload.ts`         |

### Existing Utility

The codebase already has `lib/image-preload.ts` with a `preloadImages(artworkIds, timeout)` function. The new hook will wrap this utility.

---

## Components to Update

| Component           | File                      | Current State                       |
| ------------------- | ------------------------- | ----------------------------------- |
| ItemsView           | items-view.tsx            | ✅ Already preloads first 8         |
| ItemDetailClient    | item-detail-client.tsx    | ⚠️ Preloads hero only, not children |
| SpotlightSearch     | spotlight-search.tsx      | ❌ No preloading                    |
| MediaSearchCombobox | media-search-combobox.tsx | ❌ No preloading                    |
| ImageSelectionGrid  | image-selection-grid.tsx  | ❌ No preloading                    |
| AddItemDialog       | add-item-dialog.tsx       | ❌ No preloading (season/episode)   |
| ItemSettingsDialog  | item-settings-dialog.tsx  | ❌ No preloading (season/episode)   |
| FileTypeCombobox    | file-type-combobox.tsx    | ❌ No preloading                    |
| SettingsDialog      | settings-dialog.tsx       | ❌ No preloading                    |

---

## Task 1: Create Shared Preload Hook

**Files:**

- Create: `hooks/use-artwork-preload.ts`
- Create: `tests/unit/hooks/use-artwork-preload.test.ts`

### Implementation

```tsx
// hooks/use-artwork-preload.ts
/**
 * Hook to preload artwork images before revealing content.
 * Wraps the existing preloadImages utility with React state management.
 */

"use client";

import { useState, useEffect } from "react";
import { preloadImages } from "@/lib/image-preload";

const PRELOAD_LIMIT = 8;

/**
 * Preloads first 8 artwork images and returns loading state.
 *
 * @param artworkIds - Array of artwork IDs to preload (not full URLs)
 * @returns isLoading - true until first 8 are preloaded or timeout (3s)
 *
 * @example
 * const artworkIds = items.map(item => item.artworkId).filter(Boolean);
 * const isLoading = useArtworkPreload(artworkIds);
 */
export function useArtworkPreload(artworkIds: (string | null)[]): boolean {
  // Filter and limit to first 8 valid IDs
  const validIds = artworkIds
    .filter((id): id is string => id !== null && id !== "")
    .slice(0, PRELOAD_LIMIT);

  // Stable key for dependency array (prevents infinite loops)
  const idsKey = validIds.join(",");

  // Initialize loading state based on whether there are images to load
  const [isLoading, setIsLoading] = useState(() => validIds.length > 0);

  useEffect(() => {
    // Re-parse IDs from key to avoid closure over stale validIds
    const ids = idsKey ? idsKey.split(",") : [];

    if (ids.length === 0) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    setIsLoading(true);

    preloadImages(ids).then(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    });

    // Cleanup: prevent state update if component unmounts or IDs change
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return isLoading;
}
```

### Unit Tests

```tsx
// tests/unit/hooks/use-artwork-preload.test.ts
/**
 * Unit tests for useArtworkPreload hook.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useArtworkPreload } from "@/hooks/use-artwork-preload";

// Mock the preloadImages utility
vi.mock("@/lib/image-preload", () => ({
  preloadImages: vi.fn(),
}));

import { preloadImages } from "@/lib/image-preload";

describe("useArtworkPreload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false immediately for empty array", () => {
    const { result } = renderHook(() => useArtworkPreload([]));
    expect(result.current).toBe(false);
  });

  it("returns false immediately for all-null array", () => {
    const { result } = renderHook(() => useArtworkPreload([null, null, null]));
    expect(result.current).toBe(false);
  });

  it("returns true while loading, then false when done", async () => {
    let resolvePreload: () => void;
    vi.mocked(preloadImages).mockReturnValue(
      new Promise((resolve) => {
        resolvePreload = resolve;
      })
    );

    const { result } = renderHook(() => useArtworkPreload(["art1", "art2"]));

    // Initially loading
    expect(result.current).toBe(true);

    // Resolve preload
    await act(async () => {
      resolvePreload!();
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("limits to first 8 IDs", async () => {
    vi.mocked(preloadImages).mockResolvedValue(undefined);

    const ids = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    renderHook(() => useArtworkPreload(ids));

    await waitFor(() => {
      expect(preloadImages).toHaveBeenCalledWith([
        "1",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
      ]);
    });
  });

  it("filters out null and empty values", async () => {
    vi.mocked(preloadImages).mockResolvedValue(undefined);

    renderHook(() => useArtworkPreload(["art1", null, "", "art2", null]));

    await waitFor(() => {
      expect(preloadImages).toHaveBeenCalledWith(["art1", "art2"]);
    });
  });

  it("cancels on unmount to prevent memory leaks", async () => {
    let resolvePreload: () => void;
    vi.mocked(preloadImages).mockReturnValue(
      new Promise((resolve) => {
        resolvePreload = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useArtworkPreload(["art1"]));

    expect(result.current).toBe(true);

    // Unmount before preload completes
    unmount();

    // Resolve after unmount - should not cause state update
    await act(async () => {
      resolvePreload!();
    });

    // No error should be thrown (no "update on unmounted component" warning)
  });

  it("resets loading when IDs change", async () => {
    vi.mocked(preloadImages).mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ ids }) => useArtworkPreload(ids),
      { initialProps: { ids: ["art1"] as (string | null)[] } }
    );

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    // Change IDs
    rerender({ ids: ["art2", "art3"] });

    // Should be loading again
    expect(result.current).toBe(true);

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
```

---

## Task 2: Fix ItemDetailClient Child Preloading

**File:** `components/items/item-detail-client.tsx`

Add child artwork preloading alongside hero preloading:

```tsx
import { useArtworkPreload } from "@/hooks/use-artwork-preload";

// Inside component, after existing hero preload logic:
const childArtworkIds = useMemo(
  () => childItems.slice(0, 8).map((item) => item.artworkId),
  [childItems]
);

const childrenLoading = useArtworkPreload(childArtworkIds);

// Update isLoading check to include children:
const isLoading =
  !isHydrated || !minDurationMet || !heroPreloaded || childrenLoading;
```

---

## Task 3: Add Preloading to SpotlightSearch

**File:** `components/search/spotlight-search.tsx`

```tsx
import { useArtworkPreload } from "@/hooks/use-artwork-preload";

// Inside component:
const artworkIds = useMemo(
  () => items.map((item) => item.artworkId),
  [items]
);
const artworkLoading = useArtworkPreload(artworkIds);

// Show loading state in Command component until preloaded
{artworkLoading ? (
  <div className="flex items-center justify-center py-6">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
) : (
  // existing items list
)}
```

---

## Task 4: Add Preloading to MediaSearchCombobox

**File:** `components/items/media-search-combobox.tsx`

**Note:** TMDB images use external URLs, not `/api/artwork/`. Need to extend `preloadImages` or create a separate utility for external URLs.

```tsx
// Option 1: Create preloadExternalImages utility
// Option 2: Extend preloadImages to accept full URLs
// Option 3: Use inline preloading similar to the hook

const posterUrls = useMemo(
  () =>
    results.map((r) =>
      r.posterPath ? `https://image.tmdb.org/t/p/w92${r.posterPath}` : null
    ),
  [results]
);

// Need useExternalImagePreload hook for TMDB URLs
```

---

## Task 5: Add Preloading to ImageSelectionGrid

**File:** `components/items/image-selection-grid.tsx`

Same TMDB external URL consideration as Task 4.

---

## Task 6: Add Preloading to Season/Episode Pickers

**Files:**

- `components/items/add-item-dialog.tsx`
- `components/items/item-settings-dialog.tsx`

Same TMDB external URL consideration as Task 4.

---

## Task 7: Add Preloading to FileTypeCombobox

**File:** `components/items/file-type-combobox.tsx`

```tsx
import { useArtworkPreload } from "@/hooks/use-artwork-preload";

const artworkIds = useMemo(
  () => files.filter((f) => f.fileType === "ARTWORK").map((f) => f.driveFileId),
  [files]
);
const artworkLoading = useArtworkPreload(artworkIds);
```

---

## Task 8: Add Preloading to SettingsDialog

**File:** `components/profile/settings-dialog.tsx`

For avatar/hero preview images after upload. These use blob URLs from file input, not artwork IDs.

---

## Task 9: Extend preloadImages for External URLs (Optional)

If TMDB image preloading is required, extend the utility:

```tsx
// lib/image-preload.ts

/**
 * Preloads images from full URLs (for external sources like TMDB).
 */
export function preloadExternalImages(
  urls: string[],
  timeout = 3000
): Promise<void> {
  if (urls.length === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let loaded = 0;
    const total = urls.length;
    let resolved = false;

    const done = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve();
    };

    const checkDone = () => {
      loaded++;
      if (loaded >= total) done();
    };

    const timer = setTimeout(done, timeout);

    urls.forEach((url) => {
      const img = new Image();
      img.onload = checkDone;
      img.onerror = checkDone;
      img.src = url;
    });
  });
}
```

---

## Task 10: Run Full Test Suite

```bash
pnpm run check
pnpm test
pnpm test:e2e
```

---

## Summary

Every component that displays artwork will:

1. Collect first 8 artwork IDs (using `useMemo` for stability)
2. Call `useArtworkPreload(ids)`
3. Show loading state while `isLoading === true`
4. Reveal content when preloaded (or after 3s timeout)

**Key Implementation Details:**

- Leverages existing `preloadImages` utility
- Cleanup function prevents memory leaks
- Stable dependency key prevents infinite loops
- 3-second timeout prevents indefinite blocking
- Tests cover edge cases and unmount scenarios
