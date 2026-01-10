# Deployment 0.28.0 - Loading Spinner UX Enhancement

**Date**: 2026-01-07
**Branch**: development

## Summary

This release adds a loading spinner that prevents the jarring view mode flash when users have grid view stored in localStorage. Previously, the server rendered tree view, then the client switched to grid after hydration - causing a visual flash. Now a spinner displays until hydration completes, artwork is preloaded (for grid view), and a minimum 300ms duration has passed.

## Changes

### Loading Spinner Pattern

New full-page loading state that hides all content until ready:

| Component                           | Loading Behavior                        |
| ----------------------------------- | --------------------------------------- |
| ItemsView (My Items page)           | Hydration + artwork preload + 300ms min |
| ItemDetailClient (Item detail page) | Hydration + 300ms min                   |
| FilteredItemsView Suspense          | Consistent spinner fallback             |

### Image Preloading Utility

New `lib/image-preload.ts` utility for preloading artwork:

```typescript
// Preloads first 8 artworks for grid view
await preloadImages(artworkIds, timeout);

// Features:
// - Promise-based API
// - 3-second timeout fallback
// - Resolves on success, error, OR timeout (never blocks UI)
```

### Minimum Duration Pattern

Best practice UX pattern prevents spinner flicker:

```typescript
// Show spinner for at least 300ms
useEffect(() => {
  const timer = setTimeout(() => setMinDurationMet(true), 300);
  return () => clearTimeout(timer);
}, []);

const isLoading = !isHydrated || !minDurationMet || !artworkReady;
```

This prevents jarring flash when loading completes very quickly (< 100ms).

### UI Updates

| Change             | Description                                             |
| ------------------ | ------------------------------------------------------- |
| Full-page spinner  | Hides toolbar, hero, and items during load              |
| flex-1 containers  | Page containers grow to fill space for centered spinner |
| Consistent styling | Same spinner across all item pages                      |

## Files Changed

```
# New files
lib/image-preload.ts                              # Artwork preloading utility
components/ui/spinner.tsx                         # shadcn spinner component
e2e/journeys/items/items-loading.spec.ts          # Loading E2E tests
tests/unit/components/items-view-loading.test.ts  # preloadImages unit tests

# Modified - Core components
components/items/items-view.tsx                   # Hydration + preload + min duration
components/items/item-detail-client.tsx           # Hydration + min duration
components/items/filtered-items-view.tsx          # Spinner Suspense fallback

# Modified - Pages
app/(my-items)/my-items/page.tsx                  # flex-1 container
app/(my-items)/my-items/[itemId]/page.tsx         # flex-1 container

# Modified - Tests
tests/unit/components/items/item-detail-client.test.tsx  # Fake timers for loading
e2e/pages/items.page.ts                           # Loading page object methods

# Modified - Config
package.json                                      # Version bump to 0.28.0
```

## Test Results

| Suite             | Result      |
| ----------------- | ----------- |
| Unit tests        | 499 passed  |
| Integration tests | 71 passed   |
| E2E tests         | ~293 passed |

### New Tests

| Test File                  | Tests | Coverage                 |
| -------------------------- | ----- | ------------------------ |
| items-view-loading.test.ts | 10    | preloadImages utility    |
| items-loading.spec.ts      | 6     | Loading spinner E2E      |
| item-detail-client.test.ts | 12    | Updated with fake timers |

## Deployment Steps

1. Pull latest from development branch
2. Run `pnpm install` (no new dependencies)
3. Run `pnpm run check` to verify build
4. Deploy to Vercel

No database migrations required.

## Architecture Notes

### Hydration Detection Pattern

Standard React pattern for detecting client-side hydration:

```typescript
const [isHydrated, setIsHydrated] = useState(false);
useEffect(() => setIsHydrated(true), []);
```

This ensures we don't show stale server-rendered content while localStorage view mode is being applied.

### Artwork Preload Key

Memoized key prevents re-render loops when items change:

```typescript
const artworkPreloadKey = useMemo(() => {
  return `${parentId ?? "root"}:${currentLevelItems
    .slice(0, 8)
    .map((item) => item.artworkId)
    .filter(Boolean)
    .join(",")}`;
}, [parentId, currentLevelItems]);
```

Key changes on navigation, triggering fresh preload for new item set.

### UX Best Practices Applied

Based on [spin-delay](https://github.com/smeijer/spin-delay) recommendations:

- **< 200ms load**: Would skip spinner (but we always show for hydration)
- **200-500ms load**: Show spinner with minimum duration
- **> 3s load**: Timeout fallback (never block indefinitely)
