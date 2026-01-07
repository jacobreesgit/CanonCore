# Items Loading Spinner Design

## Problem

When users have grid view stored in localStorage, they experience a visual flash:

1. Server renders tree view (server snapshot returns "tree")
2. Page hydrates, reads localStorage, finds "grid"
3. View switches from tree to grid - jarring UX

Additionally, grid view shows before artwork images are loaded, causing layout shifts.

## Solution

Add a loading spinner that displays until:

- **Tree view**: Hydration completes (immediate)
- **Grid view**: Hydration completes AND first 8 artworks are preloaded

## Implementation

### 1. Loading State Logic

Add to `components/items/items-view.tsx`:

```typescript
const [isHydrated, setIsHydrated] = useState(false);
const [artworksReady, setArtworksReady] = useState(false);

// Stable key for artwork preloading - memoized to prevent re-render loops
const artworkPreloadKey = useMemo(() => {
  return currentLevelItems
    .slice(0, 8)
    .map((item) => item.artworkId)
    .filter(Boolean)
    .join(",");
}, [currentLevelItems]);

// Hydration detection
useEffect(() => {
  setIsHydrated(true);
}, []);

// Reset artworksReady when items change (navigation between pages)
useEffect(() => {
  setArtworksReady(false);
}, [parentId, artworkPreloadKey]);

// Artwork preloading (only for grid view)
useEffect(() => {
  if (!isHydrated) return;

  // Tree view doesn't need preloading
  if (viewMode !== "grid") {
    setArtworksReady(true);
    return;
  }

  const artworkIds = artworkPreloadKey.split(",").filter(Boolean);

  // No artworks to preload
  if (artworkIds.length === 0) {
    setArtworksReady(true);
    return;
  }

  // Track if effect is still active (cleanup on unmount or deps change)
  let cancelled = false;

  preloadImages(artworkIds).then(() => {
    if (!cancelled) {
      setArtworksReady(true);
    }
  });

  // Cleanup: ignore stale preload results
  return () => {
    cancelled = true;
  };
}, [isHydrated, viewMode, artworkPreloadKey]);

const isLoading = !isHydrated || !artworksReady;
```

### 2. Image Preloading Utility

```typescript
/**
 * Preloads images by artwork ID and resolves when all are loaded (or failed).
 * Uses a timeout to prevent indefinite waiting on slow connections.
 *
 * @param artworkIds - Array of artwork file IDs to preload
 * @param timeout - Maximum time to wait in milliseconds (default: 3000)
 */
function preloadImages(artworkIds: string[], timeout = 3000): Promise<void> {
  if (artworkIds.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let loaded = 0;
    const total = artworkIds.length;
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

    artworkIds.forEach((id) => {
      const img = new Image();
      img.onload = checkDone;
      img.onerror = checkDone; // Count errors as done - don't block UI
      img.src = `/api/artwork/${id}`;
    });
  });
}
```

### 3. Spinner UI

Install shadcn spinner and update render:

```bash
pnpm dlx shadcn@latest add spinner -y
```

```tsx
import { Spinner } from "@/components/ui/spinner";

{/* Items display */}
<div className="min-h-[200px]">
  {isLoading ? (
    <div className="flex min-h-[200px] items-center justify-center">
      <Spinner className="text-muted-foreground size-8" />
    </div>
  ) : items.length === 0 ? (
    <EmptyState onOpenAddItem={() => setAddItemOpen(true)} />
  ) : viewMode === "grid" ? (
    // ... existing grid/sortable grid rendering
  ) : (
    // ... existing tree/sortable tree rendering
  )}
</div>
```

## Files to Modify

| File                              | Change                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `components/items/items-view.tsx` | Add loading state, hydration tracking, preloadImages utility, Spinner |
| `components/ui/spinner.tsx`       | New file (via shadcn)                                                 |

## Testing

### Unit Tests

Create `tests/unit/components/items-view-loading.test.ts`:

1. **preloadImages utility**:
   - Resolves immediately for empty array
   - Resolves when all images load
   - Resolves on timeout if images are slow
   - Handles image errors gracefully (doesn't block)

### E2E Tests

Create `e2e/journeys/items/items-loading.spec.ts`:

1. **Loading spinner visibility**:
   - Spinner shows briefly on initial page load
   - Spinner disappears before content renders

2. **No view flash (grid preference)**:
   - Set localStorage to "grid" before navigation
   - Navigate to My Items
   - Assert: While spinner is visible, neither `[data-testid="items-tree-view"]` nor `[data-testid="items-grid-view"]` exists
   - Assert: After spinner clears, only `[data-testid="items-grid-view"]` exists

3. **Tree view fast path**:
   - Set localStorage to "tree"
   - Navigate to My Items
   - Assert tree renders quickly (no artwork preloading delay)

4. **Grid artwork preloading**:
   - Navigate with grid preference and items with artwork
   - Assert first 8 artworks are in browser cache when grid appears

5. **Mixed items (some with artwork, some without)**:
   - Navigate with items where some have artworkId and some don't
   - Assert grid renders after preloading only items with artwork

6. **Navigation resets loading state**:
   - Navigate to My Items (grid loads)
   - Navigate to item detail page
   - Assert spinner shows again for new content

### Tests to Update

Review existing E2E tests in `e2e/journeys/items/` - may need to wait for spinner to clear:

- `items-crud.spec.ts`
- `items-drag-drop.spec.ts`
- `items-views.spec.ts`

## Implementation Steps

1. Install shadcn spinner component
2. Add `preloadImages` utility function to `items-view.tsx`
3. Add hydration and artwork loading state with proper memoization
4. Add cleanup function for race condition handling
5. Update render to show Spinner during loading
6. Write unit tests for preloadImages
7. Write E2E tests for loading behavior
8. Update existing E2E tests if needed (wait for spinner)
9. Run full test suite and verify no regressions
