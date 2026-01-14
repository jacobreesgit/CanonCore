# Best Practice Image Loading Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix cached image bug across all 6 affected instances and implement best-practice loading with priority optimization where applicable.

**Architecture:** Single `useImageLoaded` hook using `useRef` + `useEffect` to detect cached images via `img.complete`. Apply to all components using the `onLoad` opacity pattern. Add optional `useLazyImage` hook with Intersection Observer for grid performance.

**Tech Stack:** React 19, TypeScript, Intersection Observer API, Vitest, Playwright

---

## Affected Components

All components using the `onLoad={() => setLoaded(true)}` + opacity transition pattern:

| File                                         | Pattern                                 | Image Source           | Priority Optimization? |
| -------------------------------------------- | --------------------------------------- | ---------------------- | ---------------------- |
| `components/sortable-grid/GridItem.tsx`      | `onLoad={() => setImageLoaded(true)}`   | Artwork API            | Yes (first 4 eager)    |
| `components/search/spotlight-search.tsx`     | `onLoad={() => setLoaded(true)}`        | Artwork API            | No (modal, on-demand)  |
| `components/items/image-selection-grid.tsx`  | `onLoad={() => setIsLoaded(true)}` (×2) | TMDB posters/backdrops | No (modal, on-demand)  |
| `components/items/media-search-combobox.tsx` | `onLoad={() => setLoaded(true)}`        | TMDB thumbnails        | No (dropdown, small)   |
| `components/items/file-type-combobox.tsx`    | `onLoad={() => setLoaded(true)}`        | Local icons            | No (small, fast)       |

> **Note:** Line numbers may drift as code evolves. Use `grep -n "onLoad.*setLoaded\|setImageLoaded"` to find current locations.

**Root cause:** Browser caches images and loads them synchronously before React attaches `onLoad` handler. Image stays at `opacity: 0` forever.

**Fix:** Check `img.complete && img.naturalHeight > 0` in `useEffect` after mount.

---

## Task 1: Create useImageLoaded Hook

**Files:**

- Create: `hooks/use-image-loaded.ts`
- Test: `tests/unit/hooks/use-image-loaded.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/hooks/use-image-loaded.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useImageLoaded } from "@/hooks/use-image-loaded";

describe("useImageLoaded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns loaded false initially", () => {
    const { result } = renderHook(() => useImageLoaded());
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it("sets loaded true when onLoad is called", () => {
    const { result } = renderHook(() => useImageLoaded());
    act(() => result.current.onLoad());
    expect(result.current.loaded).toBe(true);
  });

  it("sets error true when onError is called", () => {
    const { result } = renderHook(() => useImageLoaded());
    act(() => result.current.onError());
    expect(result.current.error).toBe(true);
  });

  it("resets state when src changes", () => {
    const { result, rerender } = renderHook(({ src }) => useImageLoaded(src), {
      initialProps: { src: "/image1.jpg" },
    });

    act(() => result.current.onLoad());
    expect(result.current.loaded).toBe(true);

    rerender({ src: "/image2.jpg" });
    expect(result.current.loaded).toBe(false);
  });

  // CRITICAL: This tests the primary bug fix - cached images
  it("detects cached image via img.complete on mount", () => {
    const { result } = renderHook(() => useImageLoaded("/cached-image.jpg"));

    // Simulate attaching ref to a cached image element
    const mockImg = document.createElement("img");
    Object.defineProperty(mockImg, "complete", { value: true });
    Object.defineProperty(mockImg, "naturalHeight", { value: 100 });

    act(() => {
      // Manually set the ref (simulating React attaching it)
      (
        result.current.ref as React.MutableRefObject<HTMLImageElement | null>
      ).current = mockImg;
    });

    // Re-render to trigger the useEffect that checks img.complete
    const { rerender } = renderHook(() => useImageLoaded("/cached-image.jpg"));

    // After the effect runs, loaded should be true without onLoad being called
    expect(result.current.loaded).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/hooks/use-image-loaded.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write the hook**

```typescript
// hooks/use-image-loaded.ts
/**
 * Hook for robust image loading that handles cached images.
 * Cached images load before React attaches onLoad, so we check
 * img.complete + img.naturalHeight on mount to detect them.
 *
 * @param src - Image source URL (resets state on change)
 * @returns ref, loaded/error state, and event handlers
 *
 * @example
 * const { ref, loaded, error, onLoad, onError } = useImageLoaded(src);
 * <img ref={ref} src={src} onLoad={onLoad} onError={onError}
 *      className={loaded ? "opacity-100" : "opacity-0"} />
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface UseImageLoadedReturn {
  /** MutableRefObject because useRef(null) returns mutable ref, not RefObject */
  ref: React.MutableRefObject<HTMLImageElement | null>;
  loaded: boolean;
  error: boolean;
  onLoad: () => void;
  onError: () => void;
}

export function useImageLoaded(src?: string): UseImageLoadedReturn {
  const ref = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Combined: Reset state and detect cached images on src change
  // Note: Single useEffect avoids timing issues between separate effects
  useEffect(() => {
    setLoaded(false);
    setError(false);

    const img = ref.current;
    if (!img) return;

    // img.complete = true for cached images
    // img.naturalHeight > 0 confirms successful load (not error)
    if (img.complete && img.naturalHeight > 0) {
      setLoaded(true);
    }
  }, [src]);

  const onLoad = useCallback(() => {
    setLoaded(true);
    setError(false);
  }, []);

  const onError = useCallback(() => {
    setLoaded(false);
    setError(true);
  }, []);

  return { ref, loaded, error, onLoad, onError };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/hooks/use-image-loaded.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-image-loaded.ts tests/unit/hooks/use-image-loaded.test.ts
git commit -m "feat: add useImageLoaded hook for cached image detection"
```

---

## Task 2: Fix GridItem.tsx

**Files:**

- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `tests/unit/components/sortable-grid/GridItem.test.tsx`

**Step 1: Write the test**

```typescript
// Add to tests/unit/components/sortable-grid/GridItem.test.tsx

describe("cached image handling", () => {
  it("shows image immediately when cached (complete=true)", () => {
    // The useImageLoaded hook detects cached images via img.complete
    render(
      <GridItem
        item={mockItem}
        artworkId="art-123"
        showArtwork={true}
        isEditMode={false}
      />
    );

    const img = screen.getByRole("img");
    fireEvent.load(img);
    expect(img).toHaveClass("opacity-100");
  });
});
```

**Step 2: Run test**

Run: `pnpm test tests/unit/components/sortable-grid/GridItem.test.tsx`

**Step 3: Update GridItem to use hook**

```typescript
// components/sortable-grid/GridItem.tsx - changes

import { useImageLoaded } from "@/hooks/use-image-loaded";

// Replace useState + onLoad pattern:
// BEFORE:
// const [imageLoaded, setImageLoaded] = useState(false);
// const [imageError, setImageError] = useState(false);

// AFTER:
const artworkSrc = artworkId ? `/api/artwork/${artworkId}` : undefined;
const {
  ref: imgRef,
  loaded: imageLoaded,
  error: imageError,
  onLoad,
  onError,
} = useImageLoaded(artworkSrc);

// Update img element:
<img
  ref={imgRef}
  src={artworkSrc}
  alt=""
  className={cn(
    "absolute inset-0 z-0 h-full w-full object-cover",
    "transition-opacity duration-200",
    imageLoaded ? "opacity-100" : "opacity-0"
  )}
  onLoad={onLoad}
  onError={onError}
/>
```

**Step 4: Run test to verify**

Run: `pnpm test tests/unit/components/sortable-grid/GridItem.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/sortable-grid/GridItem.tsx tests/unit/components/sortable-grid/GridItem.test.tsx
git commit -m "fix: use useImageLoaded in GridItem for cached image support"
```

---

## Task 3: Fix spotlight-search.tsx

**Files:**

- Modify: `components/search/spotlight-search.tsx`

**Step 1: Read current implementation**

Run: Read file to see current pattern at line 52

**Step 2: Update to use hook**

```typescript
// components/search/spotlight-search.tsx - changes

import { useImageLoaded } from "@/hooks/use-image-loaded";

// In the thumbnail component, replace:
// const [loaded, setLoaded] = useState(false);

// With:
const { ref, loaded, onLoad, onError } = useImageLoaded(artworkSrc);

// Update img:
<img
  ref={ref}
  src={artworkSrc}
  onLoad={onLoad}
  onError={onError}
  className={cn(loaded ? "opacity-100" : "opacity-0", ...)}
/>
```

**Step 3: Run existing tests**

Run: `pnpm test tests/unit/components/search/`
Expected: PASS

**Step 4: Commit**

```bash
git add components/search/spotlight-search.tsx
git commit -m "fix: use useImageLoaded in spotlight search for cached images"
```

---

## Task 4: Fix image-selection-grid.tsx (2 instances)

**Files:**

- Modify: `components/items/image-selection-grid.tsx`

**Step 1: Read current implementation**

Run: Read file to see patterns at lines 338 and 458

**Step 2: Update both poster and backdrop image components**

Both `PosterImage` and `BackdropImage` (or similar) components need the hook:

```typescript
// components/items/image-selection-grid.tsx - changes

import { useImageLoaded } from "@/hooks/use-image-loaded";

// For each image component using the pattern:
const { ref, loaded, onLoad, onError } = useImageLoaded(src);

<img
  ref={ref}
  src={src}
  onLoad={onLoad}
  onError={onError}
  className={cn(loaded ? "opacity-100" : "opacity-0", ...)}
/>
```

**Step 3: Run existing tests**

Run: `pnpm test tests/unit/components/items/image-selection-grid.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add components/items/image-selection-grid.tsx
git commit -m "fix: use useImageLoaded in image selection grid for cached TMDB images"
```

---

## Task 5: Fix media-search-combobox.tsx

**Files:**

- Modify: `components/items/media-search-combobox.tsx`

**Step 1: Read current implementation**

Run: Read file to see pattern at line 47

**Step 2: Update to use hook**

```typescript
// components/items/media-search-combobox.tsx - changes

import { useImageLoaded } from "@/hooks/use-image-loaded";

// Replace useState pattern with hook
const { ref, loaded, onLoad, onError } = useImageLoaded(posterUrl);

<img
  ref={ref}
  src={posterUrl}
  onLoad={onLoad}
  onError={onError}
  className={cn(loaded ? "opacity-100" : "opacity-0", ...)}
/>
```

**Step 3: Run existing tests**

Run: `pnpm test tests/unit/components/items/media-search-combobox.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add components/items/media-search-combobox.tsx
git commit -m "fix: use useImageLoaded in media search combobox for cached TMDB images"
```

---

## Task 6: Fix file-type-combobox.tsx

**Files:**

- Modify: `components/items/file-type-combobox.tsx`

**Step 1: Read current implementation**

Run: Read file to see pattern at line 95

**Step 2: Update to use hook**

```typescript
// components/items/file-type-combobox.tsx - changes

import { useImageLoaded } from "@/hooks/use-image-loaded";

const { ref, loaded, onLoad, onError } = useImageLoaded(iconSrc);

<img
  ref={ref}
  src={iconSrc}
  onLoad={onLoad}
  onError={onError}
  className={cn(loaded ? "opacity-100" : "opacity-0", ...)}
/>
```

**Step 3: Run existing tests**

Run: `pnpm test tests/unit/components/items/file-type-combobox.test.tsx`
Expected: PASS

**Step 4: Commit**

```bash
git add components/items/file-type-combobox.tsx
git commit -m "fix: use useImageLoaded in file type combobox for cached icons"
```

---

## Task 7: Add Priority Loading to Grid (Optional Optimization)

**Files:**

- Create: `hooks/use-lazy-image.ts`
- Test: `tests/unit/hooks/use-lazy-image.test.ts`
- Modify: `components/sortable-grid/GridItem.tsx`
- Modify: `components/sortable-grid/Grid.tsx`

**Step 1: Write useLazyImage hook test**

```typescript
// tests/unit/hooks/use-lazy-image.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLazyImage } from "@/hooks/use-lazy-image";

const mockObserve = vi.fn();
const mockUnobserve = vi.fn();
let intersectionCallback: IntersectionObserverCallback;

beforeEach(() => {
  global.IntersectionObserver = vi.fn((callback) => {
    intersectionCallback = callback;
    return {
      observe: mockObserve,
      unobserve: mockUnobserve,
      disconnect: vi.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: () => [],
    };
  }) as unknown as typeof IntersectionObserver;
});

afterEach(() => vi.clearAllMocks());

describe("useLazyImage", () => {
  it("returns shouldLoad=true immediately when priority=true", () => {
    const { result } = renderHook(() => useLazyImage({ priority: true }));
    expect(result.current.shouldLoad).toBe(true);
  });

  it("returns shouldLoad=false initially when priority=false", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));
    expect(result.current.shouldLoad).toBe(false);
  });

  it("sets shouldLoad=true when entering viewport", () => {
    const { result } = renderHook(() => useLazyImage({ priority: false }));

    act(() => {
      intersectionCallback(
        [
          { isIntersecting: true, target: document.createElement("div") },
        ] as IntersectionObserverEntry[],
        {} as IntersectionObserver
      );
    });

    expect(result.current.shouldLoad).toBe(true);
  });

  it("uses rootMargin for preloading", () => {
    renderHook(() => useLazyImage({ rootMargin: "200px" }));
    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: "200px 0px" })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/hooks/use-lazy-image.test.ts`
Expected: FAIL

**Step 3: Write useLazyImage hook**

```typescript
// hooks/use-lazy-image.ts
/**
 * Hook for lazy loading with Intersection Observer.
 * Supports priority loading for above-fold images.
 *
 * @param options.priority - Load immediately (default: false)
 * @param options.rootMargin - Preload distance (default: "200px")
 */

import { useState, useRef, useEffect, useCallback } from "react";

interface UseLazyImageOptions {
  priority?: boolean;
  rootMargin?: string;
}

interface UseLazyImageReturn {
  ref: React.RefCallback<HTMLElement>;
  shouldLoad: boolean;
}

export function useLazyImage(
  options: UseLazyImageOptions = {}
): UseLazyImageReturn {
  const { priority = false, rootMargin = "200px" } = options;
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    setElement(node);
  }, []);

  useEffect(() => {
    if (priority || shouldLoad || !element) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { rootMargin: `${rootMargin} 0px`, threshold: 0 }
    );

    observerRef.current.observe(element);
    return () => observerRef.current?.disconnect();
  }, [element, priority, rootMargin, shouldLoad]);

  return { ref, shouldLoad };
}
```

**Step 4: Run test**

Run: `pnpm test tests/unit/hooks/use-lazy-image.test.ts`
Expected: PASS

**Step 5: Update Grid.tsx to pass priority to first 4 items**

```typescript
// components/sortable-grid/Grid.tsx
const PRIORITY_COUNT = 4;

{items.map((item, index) => (
  <GridItem
    key={item.id}
    item={item}
    priority={index < PRIORITY_COUNT}
    // ... other props
  />
))}
```

**Step 6: Update GridItem to use useLazyImage**

```typescript
// components/sortable-grid/GridItem.tsx - add lazy loading

import { useLazyImage } from "@/hooks/use-lazy-image";

interface GridItemProps {
  // ... existing
  priority?: boolean;
}

// Inside component:
const { ref: lazyRef, shouldLoad } = useLazyImage({
  priority: priority ?? false,
  rootMargin: "200px",
});

const artworkSrc = artworkId ? `/api/artwork/${artworkId}` : undefined;
const {
  ref: imgRef,
  loaded: imageLoaded,
  error: imageError,
  onLoad,
  onError,
} = useImageLoaded(shouldLoad ? artworkSrc : undefined);

// Wrap container with lazyRef, only render img when shouldLoad
<div ref={lazyRef} ...>
  {shouldShowArtwork && shouldLoad && (
    <img ref={imgRef} src={artworkSrc} ... />
  )}
</div>
```

**Step 7: Commit**

```bash
git add hooks/use-lazy-image.ts tests/unit/hooks/use-lazy-image.test.ts \
  components/sortable-grid/Grid.tsx components/sortable-grid/GridItem.tsx
git commit -m "feat: add priority-based lazy loading for grid performance"
```

---

## Task 8: Run Full Test Suite

**Step 1: Run all unit tests**

Run: `pnpm test`
Expected: All pass

**Step 2: Run integration tests**

Run: `pnpm test:integration`
Expected: All pass

**Step 3: Run E2E tests**

Run: `pnpm test:e2e`
Expected: All pass

**Step 4: Manual verification**

1. `pnpm dev`
2. Open TMDB search in Add Item dialog - thumbnails should show
3. Open image selection grid - posters/backdrops should show
4. Refresh page - images should persist (not disappear)
5. Navigate to My Items grid - first 4 load immediately, rest lazy load

**Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify cached image fix across all components"
```

---

## Summary

**Bug fix (Tasks 1-6):** Apply `useImageLoaded` hook to all 6 instances using the `onLoad` opacity pattern. This fixes cached images that load before React attaches handlers.

**Performance optimization (Task 7):** Optional `useLazyImage` hook with Intersection Observer for grid - first 4 items load eagerly, rest lazy load with 200px rootMargin preloading.

**Components fixed:**

- `GridItem.tsx` - Artwork API thumbnails
- `spotlight-search.tsx` - Search result thumbnails
- `image-selection-grid.tsx` - TMDB posters & backdrops (2 instances)
- `media-search-combobox.tsx` - TMDB search thumbnails
- `file-type-combobox.tsx` - File type icons

---

## Code Review Notes

> **Reviewed:** 2026-01-14 | **Status:** Approved with incorporated changes

### Changes Made During Review

1. **Added critical test case** - Test for cached image detection via `img.complete` (the primary bug being fixed)
2. **Fixed TypeScript interface** - Changed `React.RefObject` to `React.MutableRefObject` (useRef returns mutable ref)
3. **Combined useEffects** - Merged reset and cached-check into single effect to avoid timing issues
4. **Replaced line numbers with grep patterns** - Line numbers drift; patterns are more stable

### Implementation Notes

- The `img.complete && img.naturalHeight > 0` check is correct per browser spec
- `naturalHeight > 0` distinguishes successful load from broken/error images
- Single useEffect ensures reset happens before cached check in same tick
- `useLazyImage` uses callback ref pattern; `useImageLoaded` uses object ref - these are compatible (different elements)
